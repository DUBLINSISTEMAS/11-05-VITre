"use client";

/**
 * Toggle A4 ↔ Térmica 80mm na ficha de orçamento de balcão (2026-05-29).
 *
 * Espelha o pattern de /admin/pedidos/[id]/imprimir/format-toggle.tsx
 * (duplicado por enquanto — extrair se entrar uma 3ª rota imprimível).
 */
import { FileTextIcon, ReceiptIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

export type PrintFormat = "termica" | "a4";

interface PrintFormatToggleProps {
  current: PrintFormat;
}

export function PrintFormatToggle({ current }: PrintFormatToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setFormat = (next: PrintFormat) => {
    if (next === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "a4") params.delete("formato");
    else params.set("formato", next);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `?${qs}` : "?"));
  };

  return (
    <div
      className="bg-bg-app/60 inline-flex items-center gap-0.5 rounded-md border border-line p-0.5 print:hidden"
      role="group"
      aria-label="Formato de impressão"
    >
      <FormatButton
        active={current === "termica"}
        onClick={() => setFormat("termica")}
        disabled={isPending}
        icon={<ReceiptIcon className="size-3.5" aria-hidden />}
        label="Térmica 80mm"
      />
      <FormatButton
        active={current === "a4"}
        onClick={() => setFormat("a4")}
        disabled={isPending}
        icon={<FileTextIcon className="size-3.5" aria-hidden />}
        label="Folha A4"
      />
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] font-medium transition",
        active
          ? "bg-surface text-ink-1 shadow-sm"
          : "text-ink-4 hover:bg-bg-app hover:text-ink-1",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
