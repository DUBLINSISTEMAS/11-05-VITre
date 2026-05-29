import { PlusIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";

import { loadPurchases } from "@/actions/purchase";
import { loadSuppliers } from "@/actions/supplier";
import { Pagination } from "@/components/common/pagination";
import { PurchasesListToolbar } from "@/components/admin/purchases-list-toolbar";
import { PurchasesTable } from "@/components/admin/purchases-table";
import { requireSession } from "@/lib/auth-server";
import { formatBRL } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface ComprasPageProps {
  searchParams: Promise<{
    supplier?: string;
    from?: string;
    to?: string;
    status?: string;
    page?: string;
  }>;
}

function parsePage(v: string | undefined): number {
  if (!v) return 1;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function parseStatus(v: string | undefined): "all" | "paid" | "pending" {
  if (v === "paid" || v === "pending") return v;
  return "all";
}

export default async function ComprasPage({ searchParams }: ComprasPageProps) {
  await requireSession();
  const params = await searchParams;

  const filters = {
    supplierId: params.supplier || null,
    from: params.from || null,
    to: params.to || null,
    status: parseStatus(params.status),
    page: parsePage(params.page),
  };

  const [result, suppliers] = await Promise.all([
    loadPurchases(filters),
    loadSuppliers(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasFilters =
    !!filters.supplierId ||
    !!filters.from ||
    !!filters.to ||
    filters.status !== "all";

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (filters.supplierId) usp.set("supplier", filters.supplierId);
    if (filters.from) usp.set("from", filters.from);
    if (filters.to) usp.set("to", filters.to);
    if (filters.status !== "all") usp.set("status", filters.status);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="b3-page-title">Compras</h1>
          <p className="b3-page-sub">
            Registro de entradas de mercadoria. Cada compra atualiza o custo
            do produto pelo método de custo médio móvel ponderado, soma ao
            estoque e gera movimentação na auditoria.
          </p>
        </div>
        <Link
          href="/admin/compras/novo"
          className="b3-btn b3-btn--cta gap-2"
          prefetch
        >
          <PlusIcon size={14} /> Nova compra
        </Link>
      </div>

      {/* Bloco H.C UX (2026-05-29) — totalizador no header pra responder
          "quanto comprei nesse período/desse fornecedor". Antes era só
          tabela bruta, sem total. */}
      <div className="b3-card flex flex-wrap items-baseline justify-between gap-3 rounded-[10px] p-4">
        <div>
          <p className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            {hasFilters ? "Filtrado" : "Total geral"}
          </p>
          <p className="text-ink-1 text-[20px] font-bold tabular-nums">
            {formatBRL(result.totalInCents)}
          </p>
        </div>
        <div className="text-ink-4 text-[12px] tabular-nums">
          {result.total} {result.total === 1 ? "compra" : "compras"}
          {result.total > result.pageSize ? (
            <>
              {" · página "}
              {result.page} de {totalPages}
            </>
          ) : null}
        </div>
      </div>

      <PurchasesListToolbar
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        filters={filters}
      />

      {result.total === 0 ? (
        hasFilters ? (
          <div className="b3-card p-8 text-center">
            <p className="text-ink-3 text-sm">
              Nenhuma compra bate com esses filtros.
            </p>
            <p className="text-ink-4 mt-1 text-xs">
              Limpe os filtros acima ou ajuste o período.
            </p>
          </div>
        ) : (
          <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
            <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
              <ShoppingCartIcon className="size-6" />
            </div>
            <h2 className="text-lg font-semibold text-ink-1">
              Nenhuma compra registrada
            </h2>
            <p className="text-ink-4 max-w-sm text-sm">
              Quando você lança uma entrada de mercadoria, o sistema atualiza
              estoque, custo médio do produto e gera a movimentação. Comece
              registrando sua primeira compra.
            </p>
            <Link
              href="/admin/compras/novo"
              className="b3-btn b3-btn--cta gap-2 mt-2"
              prefetch
            >
              <PlusIcon size={14} /> Registrar primeira compra
            </Link>
          </div>
        )
      ) : (
        <>
          <PurchasesTable purchases={result.rows} />
          {totalPages > 1 ? (
            <div className="border-line border-t p-3">
              <Pagination
                currentPage={result.page}
                totalPages={totalPages}
                buildHref={buildHref}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
