"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { bulkUpsertItems } from "@/lib/data/menu-actions";
import { ExportMenuButton } from "@/components/menu/ExportMenuButton";
import {
  parseSpreadsheet,
  validateRows,
  buildSampleCsv,
  BULK_COLUMNS,
  type BulkUploadMode,
  type ParsedRow,
  type RowError,
  type RawRow,
  type BulkUploadSummary,
} from "@/lib/menu/bulk-upload";

const MODE_ITEMS: { value: BulkUploadMode; label: string; help: string }[] = [
  { value: "add", label: "Add new items", help: "Insert new items. Items that already exist (same name in the same category) are skipped." },
  { value: "modify", label: "Modify existing items", help: "Update items that match by name within their category. Unmatched rows are skipped." },
  { value: "replace", label: "Replace entire menu", help: "Delete all existing items on this menu, then insert the uploaded items. Categories are kept." },
];

interface BulkUploadModalProps {
  menuId: string;
  restaurantId: string;
}

export function BulkUploadModal({ menuId }: BulkUploadModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BulkUploadMode>("add");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [valid, setValid] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<BulkUploadSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFileName(null);
    setRawRows([]);
    setValid([]);
    setErrors([]);
    setParseError(null);
    setReplaceConfirmed(false);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      setMode("add");
    }
  }

  function handleDownloadSample() {
    const blob = new Blob([buildSampleCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "menu-sample.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSummary(null);
    setParseError(null);
    setValid([]);
    setErrors([]);
    setRawRows([]);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    try {
      const { rows } = await parseSpreadsheet(file);
      const result = validateRows(rows);
      setRawRows(rows);
      setValid(result.valid);
      setErrors(result.errors);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to read the file.");
    }
  }

  async function handleSubmit() {
    if (valid.length === 0) return;
    setSubmitting(true);
    try {
      const result = await bulkUpsertItems(menuId, { mode, rows: rawRows });
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "Bulk upload failed.");
        return;
      }
      // Normalize: a stale server action (deploy/version skew) may return a
      // summary without the newer warnings field.
      const data = { ...result.data, warnings: result.data.warnings ?? [] };
      setSummary(data);
      toast.success(
        `Done — ${data.added} added, ${data.updated} updated, ${data.skipped} skipped, ${data.failed} failed` +
          (data.warnings.length > 0
            ? `, ${data.warnings.length} warning${data.warnings.length === 1 ? "" : "s"}`
            : "") +
          "."
      );
    } catch {
      toast.error("Bulk upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const hasFile = fileName !== null && parseError === null && !summary;
  const canSubmit =
    valid.length > 0 && (mode !== "replace" || replaceConfirmed) && !submitting;
  const activeMode = MODE_ITEMS.find((m) => m.value === mode)!;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Bulk upload
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk upload menu items</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to add, modify, or replace items on this menu.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <SummaryStat label="Added" value={summary.added} />
              <SummaryStat label="Updated" value={summary.updated} />
              <SummaryStat label="Skipped" value={summary.skipped} />
              <SummaryStat label="Failed" value={summary.failed} />
            </div>
            {summary.categoriesCreated > 0 && (
              <p className="text-sm text-muted-foreground">
                {summary.categoriesCreated} new categor
                {summary.categoriesCreated === 1 ? "y" : "ies"} created.
              </p>
            )}
            {summary.errors.length > 0 && <ErrorList errors={summary.errors} />}
            {summary.warnings.length > 0 && <WarningList warnings={summary.warnings} />}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Upload another
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload mode</label>
              <Select
                items={MODE_ITEMS}
                value={mode}
                onValueChange={(v) => {
                  setMode(v as BulkUploadMode);
                  setReplaceConfirmed(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODE_ITEMS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{activeMode.help}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadSample}>
                <Download className="h-4 w-4 mr-2" />
                Download sample
              </Button>
              <ExportMenuButton menuId={menuId} label="Download current menu (CSV)" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {fileName ? "Choose a different file" : "Choose file"}
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground">{fileName}</span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Columns: {BULK_COLUMNS.join(", ")}. Required: name, price, category.
              Separate multiple allergens/labels with semicolons. An optional
              leading <code className="font-mono">id</code> column (present in
              downloaded files) targets that exact item.
            </p>
            <p className="text-xs text-muted-foreground">
              Round-trip editing: download the current menu, edit it, and
              re-upload in Modify mode. In Add or Modify mode, rows with an{" "}
              <code className="font-mono">id</code> always update that item, so
              renamed items never duplicate. Replace mode re-inserts every row
              fresh — existing items are deleted first and ids are not
              preserved. Rows without an <code className="font-mono">id</code>{" "}
              match by name within their category: Add mode skips matches,
              Modify mode updates them.
            </p>
            <p className="text-xs text-muted-foreground">
              Option columns (preparations, variations, sides, sauces):
              semicolon-separated entries with an optional price in rands after
              the last colon — e.g.{" "}
              <code className="font-mono">Grilled:0;Fried:15.50;Extra cheese</code>.
              Prices are converted to cents. Omit the column to leave options empty.
            </p>
            <p className="text-xs text-muted-foreground">
              Pairings column: semicolon-separated names of other items on this
              menu — e.g.{" "}
              <code className="font-mono">Chocolate Brownie;House Merlot</code>.
              Applied to rows that are added or updated, and in Add mode also to
              items that already exist. Names are matched case-insensitively;
              unknown names are reported as warnings, not errors, and a row
              whose names all fail to resolve leaves its existing pairings
              untouched. Pairings to items on other menus are not included in
              exports — they cannot be expressed as names.
            </p>

            {parseError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {parseError}
              </div>
            )}

            {hasFile && !parseError && (
              <div className="space-y-3">
                <p className="text-sm">
                  <span className="font-medium">{valid.length}</span> valid row
                  {valid.length === 1 ? "" : "s"}
                  {errors.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-destructive">
                        {errors.length}
                      </span>{" "}
                      error{errors.length === 1 ? "" : "s"}
                    </>
                  )}
                </p>

                {valid.length > 0 && <PreviewTable rows={valid} />}
                {errors.length > 0 && <ErrorList errors={errors} />}

                {mode === "replace" && valid.length > 0 && (
                  <label className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={replaceConfirmed}
                      onChange={(e) => setReplaceConfirmed(e.target.checked)}
                    />
                    <span className="flex items-center gap-1.5 text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Delete all existing items on this menu and replace them with the{" "}
                      {valid.length} uploaded item{valid.length === 1 ? "" : "s"}.
                    </span>
                  </label>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? "Uploading…" : `Upload ${valid.length || ""} item${valid.length === 1 ? "" : "s"}`.trim()}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-2 py-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: ParsedRow[] }) {
  const preview = rows.slice(0, 10);
  return (
    <div className="max-h-56 overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.map((row, i) => (
            <TableRow key={i}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="text-right">
                {(row.price_cents / 100).toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > preview.length && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          …and {rows.length - preview.length} more.
        </p>
      )}
    </div>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  const shown = errors.slice(0, 20);
  return (
    <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {shown.map((err, i) => (
        <div key={i}>
          Row {err.row} · {err.field} · {err.reason}
        </div>
      ))}
      {errors.length > shown.length && (
        <div className="text-xs">…and {errors.length - shown.length} more.</div>
      )}
    </div>
  );
}

function WarningList({ warnings }: { warnings: RowError[] }) {
  const shown = warnings.slice(0, 20);
  return (
    <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
      <div className="flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {warnings.length} warning{warnings.length === 1 ? "" : "s"}
      </div>
      {shown.map((warning, i) => (
        <div key={i}>
          Row {warning.row} · {warning.field} · {warning.reason}
        </div>
      ))}
      {warnings.length > shown.length && (
        <div className="text-xs">…and {warnings.length - shown.length} more.</div>
      )}
    </div>
  );
}
