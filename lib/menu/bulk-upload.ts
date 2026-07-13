import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { centsToRands } from "@/lib/utils/money";

/**
 * Shared parsing + validation for the bulk menu upload feature.
 *
 * This module is framework-free (no React, no server-only imports) so it can
 * run in the browser (preview/validation in the modal) and on the server
 * (re-validation in the `bulkUpsertItems` action) and be unit-tested directly.
 */

/** Upload modes offered in the modal. */
export type BulkUploadMode = "add" | "modify" | "replace";

/** Maximum number of data rows accepted in a single upload. */
export const MAX_ROWS = 2000;

/**
 * Canonical column order for the sample file and parsing. Required columns are
 * `name`, `price`, `category`; the rest are optional.
 *
 * Option columns (`preparations`, `variations`, `sides`, `sauces`) use the
 * same semicolon convention as `allergens`/`labels`, one entry per option:
 * `Name:price;Name:price;Name`. The `:price` suffix is optional and is a
 * non-negative decimal in rands (e.g. `Grilled:0;Fried:15.50;Extra cheese`).
 * An entry is split on its LAST `:`, so a name containing `:` must be followed
 * by a valid price — otherwise the row is rejected with a clear error.
 *
 * The `pairings` column lists other item names on the same menu
 * (semicolon-separated, e.g. `Chocolate Brownie;House Merlot`). Names are
 * resolved to item ids in a second pass after the upload — see
 * `resolvePairings`; unresolvable names become warnings, never errors.
 */
export const BULK_COLUMNS = [
  "name",
  "description",
  "price",
  "category",
  "allergens",
  "labels",
  "image_url",
  "preparations",
  "variations",
  "sides",
  "sauces",
  "pairings",
] as const;

export type BulkColumn = (typeof BULK_COLUMNS)[number];

/** A raw row keyed by (normalized) column name, values as strings. */
export type RawRow = Record<string, string>;

/** One entry in an option column (JSON shape stored on `menu_items`). */
export type ParsedOption = {
  name: string;
  price_cents?: number;
};

/** The four option columns accepted by the bulk upload. */
export const OPTION_COLUMNS = [
  "preparations",
  "variations",
  "sides",
  "sauces",
] as const;

/** A validated row, ready to be turned into a `menu_items` insert. */
export interface ParsedRow {
  /** Optional item UUID from an exported file; `null` for new rows. */
  id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  allergens: string[];
  labels: string[];
  image_url: string | null;
  preparations: ParsedOption[];
  variations: ParsedOption[];
  sides: ParsedOption[];
  sauces: ParsedOption[];
  /** Names of other items on this menu; resolved to ids after the upsert. */
  pairings: string[];
  /** 1-based file row (incl. header), so server-side warnings match the file. */
  fileRow: number;
}

/** A single validation failure, addressed by 1-based file row (incl. header). */
export interface RowError {
  row: number;
  field: string;
  reason: string;
}

/** Payload sent from the modal to the `bulkUpsertItems` server action. */
export interface BulkUploadPayload {
  mode: BulkUploadMode;
  rows: RawRow[];
}

/** Summary returned by `bulkUpsertItems` and shown in the modal. */
export interface BulkUploadSummary {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  categoriesCreated: number;
  errors: RowError[];
  /** Non-fatal issues (e.g. pairing names that matched no item). */
  warnings: RowError[];
}

/** Split a semicolon-separated cell into a trimmed list, dropping empties. */
function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Rands → cents, same convention as `upsertItem` (`Math.round(value * 100)`). */
function randToCents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Parse one option column cell (`Name:price;Name:price;Name`) into
 * `{ name, price_cents? }[]`. Each entry is split on its LAST `:`; the suffix
 * must be a non-negative decimal in rands. Blank entries and trailing
 * semicolons are ignored. Errors use the same `{ row, field, reason }` shape
 * as the rest of the parser; `rowIndex` is the 1-based file row (incl. header).
 */
export function parseOptionList(
  raw: string,
  column: string,
  rowIndex: number
): { options: ParsedOption[]; errors: RowError[] } {
  const options: ParsedOption[] = [];
  const errors: RowError[] = [];
  const fail = (reason: string) => errors.push({ row: rowIndex, field: column, reason });

  for (const entry of splitList(raw)) {
    const separator = entry.lastIndexOf(":");
    if (separator === -1) {
      options.push({ name: entry });
      continue;
    }
    const name = entry.slice(0, separator).trim();
    const priceStr = entry.slice(separator + 1).trim();
    if (!name) {
      fail(`Option "${entry}" is missing a name before ":".`);
      continue;
    }
    const price = Number(priceStr);
    if (priceStr === "" || !Number.isFinite(price) || price < 0) {
      fail(
        `Option "${name}" has an invalid price "${priceStr}". ` +
          "Prices must be non-negative decimals in rands (e.g. 15.50)."
      );
      continue;
    }
    options.push({ name, price_cents: randToCents(price) });
  }

  return { options, errors };
}

/**
 * Serialize one option column back to the importer's `Name:price;Name`
 * encoding (the inverse of `parseOptionList`). A name containing `:` MUST get
 * an explicit price suffix, because the importer splits each entry on its LAST
 * `:` and requires a valid price after it — a bare `House sauce: spicy` would
 * fail to re-import. When the stored option has no price, `:0.00` is emitted
 * (accepting the 0-vs-absent semantic so export → import round-trips).
 */
export function serializeOptionList(options: ParsedOption[]): string {
  return options
    .map((opt) => {
      const name = opt.name.trim();
      const needsPrice = opt.price_cents !== undefined || name.includes(":");
      return needsPrice ? `${name}:${centsToRands(opt.price_cents ?? 0)}` : name;
    })
    .join(";");
}

/** Zod field for one option column; rejects the row on any bad entry. */
function optionListField(column: (typeof OPTION_COLUMNS)[number]) {
  return z
    .string()
    .optional()
    .transform((v, ctx) => {
      const { options, errors } = parseOptionList(v ?? "", column, 0);
      for (const error of errors) {
        ctx.addIssue({ code: "custom", message: error.reason });
      }
      return errors.length > 0 ? z.NEVER : options;
    });
}

/**
 * Row schema mirroring the relevant subset of `ItemSchema` in
 * `lib/schemas/menu.ts`. Inputs are strings (CSV/Excel cells); `price` is
 * transformed to `price_cents` using the same convention as `upsertItem`
 * (`Math.round(value * 100)`).
 */
export const BulkRowSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.union([z.literal(""), z.string().uuid("id must be a valid item UUID.")]))
    .transform((v) => (v.length > 0 ? v : null)),
  name: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Item name is required.")),
  description: z
    .string()
    .optional()
    .transform((v) => {
      const trimmed = (v ?? "").trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .pipe(z.string().max(2000, "Description must be 2000 characters or fewer.").nullable()),
  price: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Price is required."))
    .transform((v, ctx) => {
      const num = Number(v);
      if (!Number.isFinite(num)) {
        ctx.addIssue({ code: "custom", message: "Price must be a number." });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({ code: "custom", message: "Price must be non-negative." });
        return z.NEVER;
      }
      return randToCents(num);
    }),
  category: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Category is required.")),
  allergens: z
    .string()
    .optional()
    .transform((v) => splitList(v)),
  labels: z
    .string()
    .optional()
    .transform((v) => splitList(v)),
  image_url: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.union([z.literal(""), z.string().url("Image URL must be a valid URL.")]))
    .transform((v) => (v.length > 0 ? v : null)),
  preparations: optionListField("preparations"),
  variations: optionListField("variations"),
  sides: optionListField("sides"),
  sauces: optionListField("sauces"),
  pairings: z
    .string()
    .optional()
    .transform((v) => splitList(v)),
});

/** Map a raw parsed row into the shape `BulkRowSchema` expects. */
function toSchemaInput(raw: RawRow): Record<string, string> {
  const input: Record<string, string> = { id: raw.id ?? "" };
  for (const col of BULK_COLUMNS) {
    input[col] = raw[col] ?? "";
  }
  return input;
}

/**
 * Validate raw rows. Returns the valid `ParsedRow`s and a flat list of
 * `{ row, field, reason }` errors. `row` is 1-based and includes the header
 * (so the first data row is row 2), matching what a user sees in a spreadsheet.
 */
export function validateRows(rawRows: RawRow[]): {
  valid: ParsedRow[];
  errors: RowError[];
} {
  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];

  rawRows.forEach((raw, index) => {
    const fileRow = index + 2; // +1 for 0-based, +1 for header
    const result = BulkRowSchema.safeParse(toSchemaInput(raw));
    if (result.success) {
      const { price, ...rest } = result.data;
      valid.push({ ...rest, price_cents: price, fileRow });
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          row: fileRow,
          field: String(issue.path[0] ?? "row"),
          reason: issue.message,
        });
      }
    }
  });

  return { valid, errors };
}

/** Lowercase + trim header keys so column matching is case-insensitive. */
function normalizeRow(row: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normKey = key.trim().toLowerCase();
    out[normKey] = value == null ? "" : String(value);
  }
  return out;
}

function isExcel(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

/**
 * Parse a CSV or Excel `File` into normalized raw rows. Detects format by
 * extension. Throws an `Error` (with a user-facing message) for unsupported
 * formats, empty files, or files exceeding `MAX_ROWS`.
 */
export async function parseSpreadsheet(file: File): Promise<{ rows: RawRow[] }> {
  let rawObjects: Record<string, unknown>[];

  if (isExcel(file)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("The spreadsheet has no sheets.");
    const sheet = workbook.Sheets[firstSheetName];
    rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
  } else if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    rawObjects = result.data;
  } else {
    throw new Error("Unsupported file type. Upload a .csv, .xlsx, or .xls file.");
  }

  if (rawObjects.length === 0) {
    throw new Error("The file has no data rows.");
  }
  if (rawObjects.length > MAX_ROWS) {
    throw new Error(`Too many rows (${rawObjects.length}). The maximum is ${MAX_ROWS}.`);
  }

  return { rows: rawObjects.map(normalizeRow) };
}

/** Example rows used in the downloadable sample. */
export const SAMPLE_ROWS: Record<BulkColumn, string>[] = [
  {
    name: "Margherita Pizza",
    description: "Tomato, mozzarella, basil",
    price: "89.00",
    category: "Mains",
    allergens: "gluten;dairy",
    labels: "vegetarian",
    image_url: "",
    preparations: "Thin crust;Deep dish:10.00",
    variations: "Medium;Large:25.00",
    sides: "Chips:15.00;Side salad:20.00",
    sauces: "Garlic mayo:5.00;Peri-peri",
    pairings: "Tiramisu",
  },
  {
    name: "Tiramisu",
    description: "Classic Italian dessert",
    price: "55.50",
    category: "Desserts",
    allergens: "dairy;eggs",
    labels: "",
    image_url: "",
    preparations: "",
    variations: "Single;Double:30.00",
    sides: "",
    sauces: "",
    pairings: "",
  },
];

/** Build a CSV string (header + example rows) for the sample download. */
export function buildSampleCsv(): string {
  return Papa.unparse({
    fields: [...BULK_COLUMNS],
    data: SAMPLE_ROWS.map((row) => BULK_COLUMNS.map((col) => row[col])),
  });
}

/**
 * Serialize validation errors to a CSV report (`row,column,message`) for the
 * "Download error report" button in the upload modal. `Papa.unparse` handles
 * quoting of commas, quotes, and newlines in messages.
 */
export function buildErrorReportCsv(errors: RowError[]): string {
  return Papa.unparse({
    fields: ["row", "column", "message"],
    data: errors.map((err) => [err.row, err.field, err.reason]),
  });
}

/**
 * Column order for the menu export: the importer's columns plus a leading
 * `id` (the item UUID) so a downloaded → edited → re-uploaded file updates
 * rows in place even when names change.
 */
export const EXPORT_COLUMNS = ["id", ...BULK_COLUMNS] as const;

/** One menu item as serialized for export (prices still in cents here). */
export interface MenuExportRow {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  allergens: string[];
  labels: string[];
  image_url: string | null;
  preparations: ParsedOption[];
  variations: ParsedOption[];
  sides: ParsedOption[];
  sauces: ParsedOption[];
  /** Names of paired items, already resolved within the same menu. */
  pairings: string[];
}

/**
 * Serialize menu items to a CSV string in exactly the format the importer
 * accepts (plus the leading `id` column): prices as decimal rands, option
 * columns in the `Name:price;Name` encoding, pairings as item names.
 * `Papa.unparse` handles quoting of commas, quotes, and newlines.
 */
export function buildMenuCsv(rows: MenuExportRow[]): string {
  return Papa.unparse({
    fields: [...EXPORT_COLUMNS],
    data: rows.map((row) => [
      row.id,
      row.name,
      row.description ?? "",
      centsToRands(row.price_cents),
      row.category,
      row.allergens.join(";"),
      row.labels.join(";"),
      row.image_url ?? "",
      serializeOptionList(row.preparations),
      serializeOptionList(row.variations),
      serializeOptionList(row.sides),
      serializeOptionList(row.sauces),
      row.pairings.join(";"),
    ]),
  });
}

/** A written row participating in pairing resolution. */
export interface PairingRow {
  /** 1-based file row (incl. header), used in warnings. */
  fileRow: number;
  /** The row's own item name (fallback for finding its id). */
  name: string;
  /**
   * The item's UUID when the row carried an explicit `id` — preferred over
   * the name lookup, so a rename that collides with another item's name
   * can't misroute pairings.
   */
  ownId?: string;
  /** Pairing names as entered in the `pairings` column. */
  pairings: string[];
}

/** A resolved `pairing_ids` update for one menu item. */
export interface PairingUpdate {
  id: string;
  pairing_ids: string[];
  /** 1-based file row (incl. header), carried through for save-failure warnings. */
  fileRow: number;
}

/**
 * Resolve pairing names to item ids against a map of every item now on the
 * menu (keyed by lowercased, trimmed name). A row's own item is identified by
 * its explicit `ownId` when present, otherwise by name lookup. Mirrors the
 * safety rules of `upsertItem`: ids are deduped and an item never pairs with
 * itself. Unresolvable names become warnings (row number + unknown name),
 * never hard failures. A row that declared pairing names but resolved zero ids
 * produces no update, so its existing pairings are left untouched (the
 * warnings already tell the user); an empty `pairings` cell means "no change".
 */
export function resolvePairings(
  rows: PairingRow[],
  nameToId: ReadonlyMap<string, string>
): { updates: PairingUpdate[]; warnings: RowError[] } {
  const updates: PairingUpdate[] = [];
  const warnings: RowError[] = [];

  for (const row of rows) {
    if (row.pairings.length === 0) continue;
    // Rows that carried an explicit item id already know their own UUID;
    // no-id rows fall back to resolving their (possibly renamed) name.
    const ownId = row.ownId ?? nameToId.get(row.name.trim().toLowerCase());
    // Defensive: the action only feeds rows whose item exists on the menu
    // (written rows, plus existing items matched in add mode).
    if (!ownId) continue;

    const ids: string[] = [];
    for (const pairingName of row.pairings) {
      const id = nameToId.get(pairingName.trim().toLowerCase());
      if (!id) {
        warnings.push({
          row: row.fileRow,
          field: "pairings",
          reason: `Unknown item "${pairingName}" — no item with that name exists on this menu.`,
        });
        continue;
      }
      if (id !== ownId) ids.push(id);
    }
    // Zero resolved ids (all names unknown, or only self-references): leave
    // the item's existing pairings alone rather than wiping them.
    if (ids.length > 0) {
      updates.push({ id: ownId, pairing_ids: [...new Set(ids)], fileRow: row.fileRow });
    }
  }

  return { updates, warnings };
}
