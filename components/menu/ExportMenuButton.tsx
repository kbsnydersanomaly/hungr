"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportMenuCsv } from "@/lib/data/menu-export-actions";

interface ExportMenuButtonProps {
  menuId: string;
  label?: string;
}

/**
 * Downloads the menu as a CSV in the bulk-upload format (with an `id` column),
 * so it can be edited in a spreadsheet and re-uploaded to update in place.
 */
export function ExportMenuButton({
  menuId,
  label = "Download CSV",
}: ExportMenuButtonProps) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await exportMenuCsv(menuId);
      if (!result.ok || !result.data) {
        toast.error(result.message ?? "Failed to export menu.");
        return;
      }
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.data.slug || "menu"}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export menu.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      <Download className="h-4 w-4 mr-2" />
      {downloading ? "Exporting…" : label}
    </Button>
  );
}
