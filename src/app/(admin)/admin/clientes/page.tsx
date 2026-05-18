import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { InfoIcon, PlusIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { CustomersTable } from "@/components/admin/customers-table";
import { CustomersToolbar } from "@/components/admin/customers-toolbar";
import { Pagination } from "@/components/common/pagination";
import { customerTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { normalizeDocument } from "@/lib/document";
import { pageNumberSchema, searchTextSchema } from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

const clientesSearchSchema = z.object({
  q: searchTextSchema,
  page: pageNumberSchema,
  /** ADR-0021 — filtro PF/PJ. Vazio/inválido = todos. */
  type: z.enum(["individual", "company"]).nullish().catch(null),
});

interface ClientesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listagem de clientes — port Dublin v3 (ADR-0019, Onda A.9). Continua
 * URL-driven (CLAUDE.md #11). Busca cobre nome E telefone (ilike substring,
 * escape de wildcards). Ordenação default por createdAt desc.
 *
 * Decisões pixel-perfect vs handoff (B3ClientesScreen):
 * - H1 inline 24px font-bold tracking -0.025em (substitui AdminPageHeader)
 * - CTA "Adicionar cliente" → `b3-btn b3-btn--cta` (Link prefetch pra /novo)
 * - `b3-card` envolvendo helpbar + toolbar + tabela + pager
 * - Tabs (Todos/Ativos/Inativos) OMITIDAS — schema customer não tem campo
 *   status. Quando ADR futuro introduzir soft-delete, abrir como Onda separada
 *   (memory `handoff-vs-schema-respect-data-model`).
 */
export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: clientes page sem loja");
  }

  const { q: rawQ, page, type: typeFilter } = clientesSearchSchema.parse(
    await searchParams,
  );
  const q = rawQ.trim();

  const conditions: SQL[] = [eq(customerTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    // ADR-0021 — busca por documento (só dígitos). Se a query for >=3
    // dígitos numéricos, casa também contra document. Vazio = ignora.
    const queryDigits = normalizeDocument(q);
    const docMatch =
      queryDigits.length >= 3
        ? ilike(customerTable.document, `%${queryDigits}%`)
        : undefined;
    const condition = or(
      ilike(customerTable.name, `%${safeQ}%`),
      ilike(customerTable.phone, `%${safeQ}%`),
      docMatch,
    );
    if (condition) conditions.push(condition);
  }
  if (typeFilter) {
    conditions.push(eq(customerTable.type, typeFilter));
  }
  const whereClause = and(...conditions);

  const offset = (page - 1) * PAGE_SIZE;
  const { customers, total } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      // SÉRIE — `pg` deprecou queries paralelas no mesmo client tx.
      const customers = await tx
        .select({
          id: customerTable.id,
          name: customerTable.name,
          phone: customerTable.phone,
          email: customerTable.email,
          type: customerTable.type,
          document: customerTable.document,
          addressCity: customerTable.addressCity,
          addressState: customerTable.addressState,
          createdAt: customerTable.createdAt,
        })
        .from(customerTable)
        .where(whereClause)
        .orderBy(desc(customerTable.createdAt), asc(customerTable.name))
        .limit(PAGE_SIZE)
        .offset(offset);

      const totalRows = await tx
        .select({ value: count() })
        .from(customerTable)
        .where(whereClause);

      return { customers, total: totalRows[0]?.value ?? 0 };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = q !== "" || typeFilter != null;

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, total);
  const rangeLabel = total === 0 ? "0 de 0" : `${rangeStart} – ${rangeEnd} de ${total}`;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (typeFilter) usp.set("type", typeFilter);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* H1 + CTA Dublin v3 (substitui AdminPageHeader) */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[24px] font-bold tracking-[-0.025em] text-ink-1">
          Meus clientes
        </h1>
        <Link href="/admin/clientes/novo" className="b3-btn b3-btn--cta" prefetch>
          <PlusIcon size={14} aria-hidden />
          <span className="hidden sm:inline">Adicionar cliente</span>
          <span className="sm:hidden">Novo</span>
        </Link>
      </div>

      {customers.length === 0 && !hasFilters ? (
        <EmptyState />
      ) : (
        <div className="b3-card overflow-hidden">
          {/* Helpbar topo (cola via border-radius custom) */}
          <div className="b3-helpbar" style={{ borderRadius: "12px 12px 0 0" }}>
            <span className="b3-helpbar-ico">
              <InfoIcon className="size-3.5" aria-hidden />
            </span>
            <span className="b3-helpbar-text">
              Precisa de ajuda? <a>Assista o vídeo sobre clientes</a>
            </span>
          </div>

          {/* Toolbar: busca + ordenar/filtros + counter */}
          <Suspense
            fallback={<div className="bg-bg-app h-14 animate-pulse" />}
          >
            <CustomersToolbar rangeLabel={rangeLabel} />
          </Suspense>

          {customers.length === 0 ? (
            <NoResults />
          ) : (
            <CustomersTable customers={customers} />
          )}

          {customers.length > 0 ? (
            <div className="border-t border-line p-3">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                buildHref={buildHref}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-line flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-brand-wash text-brand flex size-12 items-center justify-center rounded-full">
        <UsersIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Cadastre seu primeiro cliente</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Telefone é a chave. Vai ser útil pra venda balcão, follow-up no
        WhatsApp e histórico de compras.
      </p>
      <Link
        href="/admin/clientes/novo"
        className="b3-btn b3-btn--cta"
        prefetch
      >
        <PlusIcon size={14} aria-hidden /> Adicionar cliente
      </Link>
    </div>
  );
}

function NoResults() {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center sm:p-12">
      <div className="bg-bg-app text-ink-4 flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-1">Nenhum cliente encontrado</h2>
      <p className="text-ink-4 max-w-sm text-sm">
        Confira nome ou telefone, ou limpe a busca.
      </p>
    </div>
  );
}
