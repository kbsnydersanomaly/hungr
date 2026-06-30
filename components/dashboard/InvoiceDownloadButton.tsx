"use client";

import { useState } from "react";
import { getInvoiceDownloadUrl } from "@/lib/data/billing-actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InvoiceDownloadButtonProps {
  invoiceId: string;
  invoiceNumber: string;
  variant?: ButtonProps["variant"];
}

export function InvoiceDownloadButton({
  invoiceId,
  invoiceNumber,
  variant = "ghost",
}: InvoiceDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await getInvoiceDownloadUrl(invoiceId);
      if (result.ok && result.data?.url) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.message ?? "Failed to open invoice");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={variant === "link" ? "h-auto p-0 text-xs" : "h-7 px-2 text-xs"}
      title={`Invoice ${invoiceNumber}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        variant !== "link" && <FileText className="h-3.5 w-3.5" />
      )}
      {invoiceNumber}
    </Button>
  );
}
