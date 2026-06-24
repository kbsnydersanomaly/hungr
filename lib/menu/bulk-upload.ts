import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";

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
 */
export const BULK_COLUMNS = [
  "name",
  "description",
  "price",
  "category",
  "allergens",
  "labels",
  "image_url",
] as const;

export type BulkColumn = (typeof BULK_COLUMNS)[number];

/** A raw row keyed by (normalized) column name, values as strings. */
export type RawRow = Record<string, string>;

/** A validated row, ready to be turned into a `menu_items` insert. */
export interface ParsedRow {
  name: string;
  description: string | null;
  price_cents: number;
  category: string;
  allergens: string[];
  labels: string[];
  image_url: string | null;
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
}

/** Split a semicolon-separated cell into a trimmed list, dropping empties. */
function splitList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Row schema mirroring the relevant subset of `ItemSchema` in
 * `lib/schemas/menu.ts`. Inputs are strings (CSV/Excel cells); `price` is
 * transformed to `price_cents` using the same convention as `upsertItem`
 * (`Math.round(value * 100)`).
 */
export const BulkRowSchema = z.object({
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
      return Math.round(num * 100);
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
});

/** Map a raw parsed row into the shape `BulkRowSchema` expects. */
function toSchemaInput(raw: RawRow): Record<string, string> {
  const input: Record<string, string> = {};
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
      valid.push({ ...rest, price_cents: price });
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
  },
  {
    name: "Tiramisu",
    description: "Classic Italian dessert",
    price: "55.50",
    category: "Desserts",
    allergens: "dairy;eggs",
    labels: "",
    image_url: "",
  },
];

/** Build a CSV string (header + example rows) for the sample download. */
export function buildSampleCsv(): string {
  return Papa.unparse({
    fields: [...BULK_COLUMNS],
    data: SAMPLE_ROWS.map((row) => BULK_COLUMNS.map((col) => row[col])),
  });
}
