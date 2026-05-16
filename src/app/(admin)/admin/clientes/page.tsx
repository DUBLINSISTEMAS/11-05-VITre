import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { PlusIcon, SearchXIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { CustomersFilters } from "@/components/admin/customers-filters";
import { CustomersTable } from "@/components/admin/customers-table";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { customerTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { pageNumberSchema, searchTextSchema } from "@/lib/page-search-params";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

const clientesSearchSchema = z.object({
  q: searchTextSchema,
  page: pageNumberSchema,
});

interface ClientesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Listagem de clientes (Fase 3 — ADR-0014).
 *
 * URL-driven (convenção CLAUDE.md #11). Busca cobre nome (ilike substring)
 * E telefone (ilike substring) com escape de wildcards. Ordenação default
 * por createdAt desc — cliente mais recente em cima.
 */
export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: clientes page sem loja");
  }

  const { q: rawQ, page } = clientesSearchSchema.parse(await searchParams);
  const q = rawQ.trim();

  const conditions: SQL[] = [eq(customerTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    const condition = or(
      ilike(customerTable.name, `%${safeQ}%`),
      ilike(customerTable.phone, `%${safeQ}%`),
    );
    if (condition) conditions.push(condition);
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
  const hasFilters = q !== "";

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Clientes"
        subtitle={
          total === 0
            ? hasFilters
              ? "Nenhum cliente bate com os filtros."
              : "Cadastre seus clientes pra ter histórico e fechar venda balcão."
            : `${total} ${total === 1 ? "cliente" : "clientes"} cadastrados`
        }
        actions={
          <Button asChild>
            <Link href="/admin/clientes/novo" prefetch>
              <PlusIcon /> <span className="hidden sm:inline">Novo cliente</span>
            </Link>
          </Button>
        }
      />

      <Suspense
        fallback={<div className="bg-muted/30 h-10 animate-pulse rounded-md" />}
      >
        <CustomersFilters />
      </Suspense>

      {customers.length === 0 ? (
        hasFilters ? (
          <NoResults />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <CustomersTable customers={customers} />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <UsersIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Cadastre seu primeiro cliente</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Telefone é a chave. Vai ser útil pra venda balcão, follow-up no
        WhatsApp e histórico de compras.
      </p>
      <Button asChild size="sm">
        <Link href="/admin/clientes/novo" prefetch>
          <PlusIcon /> Novo cliente
        </Link>
      </Button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Nenhum cliente encontrado</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Confira nome ou telefone, ou limpe a busca.
      </p>
    </div>
  );
}
