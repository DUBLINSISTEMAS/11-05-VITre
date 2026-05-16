"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
    >
      <PrinterIcon />
      {label}
    </Button>
  );
}
