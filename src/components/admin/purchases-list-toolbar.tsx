"use client";

/**
 * Bloco H.C UX (2026-05-29) — toolbar de filtros pra `/admin/compras`.
 *
 * Filtros URL-driven (?supplier, ?from, ?to, ?status). Mudanças disparam
 * router.replace com transition pra não bloquear UI.
 *
 * Sem busca textual (compra não tem campo "descrição" rico; lojista busca
 * por fornecedor/período/NF). Pra busca por NF (campo `invoice_number`),
 * extensão futura.
 */

import { CalendarIcon, FilterXIcon, SlidersHorizontalIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PurchasesListToolbarProps {
  suppliers: Array<{ id: string; name: string }>;
  filters: {
    supplierId: string | null;
    from: string | null;
    to: string | null;
    status: "all" | "paid" | "pending";
  };
}

const NO_SUPPLIER = "__all_suppliers__";

export function PurchasesListToolbar({
  suppliers,
  filters,
}: PurchasesListToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page"); // reseta paginação ao mudar filtro
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/compras?${qs}` : "/admin/compras");
    });
  };

  const hasAnyFilter =
    !!filters.supplierId ||
    !!filters.from ||
    !!filters.to ||
    filters.status !== "all";

  return (
    <div className="b3-card flex flex-wrap items-center gap-2 rounded-[10px] p-3">
      <Select
        value={filters.supplierId ?? NO_SUPPLIER}
        onValueChange={(v) =>
          updateParams({ supplier: v === NO_SUPPLIER ? null : v })
        }
      >
        <SelectTrigger className="h-9 min-w-[200px]">
          <SlidersHorizontalIcon className="size-3.5" aria-hidden />
          <SelectValue placeholder="Fornecedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SUPPLIER}>Todos fornecedores</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(v) =>
          updateParams({ status: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="h-9 min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="pending">Em aberto</SelectItem>
          <SelectItem value="paid">Pagas</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <CalendarIcon size={13} aria-hidden className="text-ink-4" />
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => updateParams({ from: e.target.value || null })}
          aria-label="Data inicial"
          className="b3-input mono h-9 text-[12px]"
        />
        <span className="text-ink-4 text-[12px]">→</span>
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => updateParams({ to: e.target.value || null })}
          aria-label="Data final"
          className="b3-input mono h-9 text-[12px]"
        />
      </div>

      {hasAnyFilter ? (
        <button
          type="button"
          onClick={() =>
            updateParams({
              supplier: null,
              from: null,
              to: null,
              status: null,
            })
          }
          className="b3-btn b3-btn--sm text-ink-3"
          title="Limpar todos os filtros"
        >
          <FilterXIcon size={12} aria-hidden /> Limpar
        </button>
      ) : null}
    </div>
  );
}
