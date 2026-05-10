import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { sql } from "drizzle-orm";
import { PackageIcon, PlusIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";

import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductsFilters } from "@/components/admin/products-filters";
import { ProductsStatusTabs } from "@/components/admin/products-status-tabs";
import {
  ProductsTable,
  type ProductTableRow,
} from "@/components/admin/products-table";
import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import {
  categoryTable,
  productImageTable,
  productTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

type StatusFilter = "active" | "inactive" | "draft" | "no-stock";
const STATUS_VALUES: ReadonlyArray<StatusFilter> = [
  "active",
  "inactive",
  "draft",
  "no-stock",
];

interface ProdutosPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    promo?: string;
    page?: string;
  }>;
}

export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: produtos page sem loja");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryId = params.categoryId?.trim() || null;
  const rawStatus = params.status ?? null;
  const statusFilter: StatusFilter | null =
    rawStatus && (STATUS_VALUES as ReadonlyArray<string>).includes(rawStatus)
      ? (rawStatus as StatusFilter)
      : null;
  const onlyPromo = params.promo === "1";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // ---- WHERE base (storeId + busca + categoria + promo) ----
  const baseConditions: SQL[] = [eq(productTable.storeId, store.id)];
  if (q) {
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    baseConditions.push(ilike(productTable.name, `%${safeQ}%`));
  }
  if (categoryId) {
    baseConditions.push(eq(productTable.categoryId, categoryId));
  }
  if (onlyPromo) {
    const now = sql`now()`;
    baseConditions.push(isNotNull(productTable.promoPriceInCents));
    const startCond = or(
      isNull(productTable.promoStartsAt),
      lte(productTable.promoStartsAt, now),
    );
    const endCond = or(
      isNull(productTable.promoEndsAt),
      gte(productTable.promoEndsAt, now),
    );
    if (startCond) baseConditions.push(startCond);
    if (endCond) baseConditions.push(endCond);
  }

  // ---- Status conditions (separadas pra permitir count por aba) ----
  const statusConditions = (s: StatusFilter | null): SQL[] => {
    if (s === "active") {
      return [
        eq(productTable.isActive, true),
        sql`${productTable.slug} not like 'draft-%'`,
        sql`btrim(${productTable.name}) <> ''`,
      ];
    }
    if (s === "inactive") {
      return [
        eq(productTable.isActive, false),
        sql`${productTable.slug} not like 'draft-%'`,
        sql`btrim(${productTable.name}) <> ''`,
      ];
    }
    if (s === "draft") {
      return [
        sql`(${productTable.slug} like 'draft-%' or btrim(${productTable.name}) = '')`,
      ];
    }
    if (s === "no-stock") {
      return [
        eq(productTable.trackStock, true),
        eq(productTable.stockQuantity, 0),
      ];
    }
    return [];
  };

  const whereClause = and(...baseConditions, ...statusConditions(statusFilter));

  // ---- Fetch paralelo: lista + total + categorias da loja + capas ----
  const offset = (page - 1) * PAGE_SIZE;
  const {
    products,
    total,
    categories,
    coversByProduct,
    tabCounts,
  } = await withTenant(store.id, session.user.id, async (tx) => {
    const countByStatus = (s: StatusFilter | null) =>
      tx
        .select({ value: count() })
        .from(productTable)
        .where(and(...baseConditions, ...statusConditions(s)));

    const [
      products,
      totalRows,
      categories,
      cAll,
      cActive,
      cInactive,
      cDraft,
      cNoStock,
    ] = await Promise.all([
      tx.query.productTable.findMany({
        where: whereClause,
        orderBy: [desc(productTable.updatedAt)],
        limit: PAGE_SIZE,
        offset,
        columns: {
          id: true,
          name: true,
          slug: true,
          basePriceInCents: true,
          promoPriceInCents: true,
          promoStartsAt: true,
          promoEndsAt: true,
          isActive: true,
          trackStock: true,
          stockQuantity: true,
        },
      }),
      tx.select({ value: count() }).from(productTable).where(whereClause),
      tx.query.categoryTable.findMany({
        where: eq(categoryTable.storeId, store.id),
        orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
        columns: { id: true, name: true, parentId: true },
      }),
      countByStatus(null),
      countByStatus("active"),
      countByStatus("inactive"),
      countByStatus("draft"),
      countByStatus("no-stock"),
    ]);

    const tabCounts = {
      all: cAll[0]?.value ?? 0,
      active: cActive[0]?.value ?? 0,
      inactive: cInactive[0]?.value ?? 0,
      draft: cDraft[0]?.value ?? 0,
      "no-stock": cNoStock[0]?.value ?? 0,
    };

    let coversByProduct = new Map<string, string>();
    if (products.length > 0) {
      const productIds = products.map((p) => p.id);
      const covers = await tx
        .select({
          productId: productImageTable.productId,
          url: productImageTable.url,
        })
        .from(productImageTable)
        .where(
          and(
            eq(productImageTable.storeId, store.id),
            eq(productImageTable.position, 0),
            inArray(productImageTable.productId, productIds),
          ),
        );
      coversByProduct = new Map(covers.map((c) => [c.productId, c.url]));
    }

    return {
      products,
      total: totalRows[0]?.value ?? 0,
      categories,
      coversByProduct,
      tabCounts,
    };
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterCategories: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));

  const hasFilters =
    q !== "" || !!categoryId || statusFilter !== null || onlyPromo;

  const buildHref = (nextPage: number) => {
    const usp = new URLSearchParams();
    if (q) usp.set("q", q);
    if (categoryId) usp.set("categoryId", categoryId);
    if (statusFilter) usp.set("status", statusFilter);
    if (onlyPromo) usp.set("promo", "1");
    if (nextPage > 1) usp.set("page", String(nextPage));
    const qs = usp.toString();
    return qs ? `?${qs}` : "?";
  };

  // ---- Mapear pra ProductTableRow ----
  const tableRows: ProductTableRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePriceInCents: p.basePriceInCents,
    promoPriceInCents: p.promoPriceInCents,
    promoStartsAt: p.promoStartsAt,
    promoEndsAt: p.promoEndsAt,
    isActive: p.isActive,
    trackStock: p.trackStock,
    stockQuantity: p.stockQuantity,
    cover: coversByProduct.get(p.id) ?? null,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Produtos"
        subtitle={renderCountLabel(total, hasFilters)}
        actions={
          <Button asChild>
            <Link href="/admin/produtos/novo">
              <PlusIcon /> <span className="hidden sm:inline">Novo produto</span>
            </Link>
          </Button>
        }
      />

      <ProductsStatusTabs counts={tabCounts} />

      <ProductsFilters categories={filterCategories} />

      {products.length === 0 ? (
        hasFilters ? (
          <NoResults onlyPromo={onlyPromo} />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <ProductsTable products={tableRows} />

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

function renderCountLabel(total: number, filtered: boolean): string {
  if (total === 0) {
    return filtered ? "Nenhum produto bate com os filtros." : "Nenhum produto ainda.";
  }
  const word = total === 1 ? "produto" : "produtos";
  return filtered ? `${total} ${word} encontrado${total === 1 ? "" : "s"}` : `${total} ${word}`;
}

function EmptyState() {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
        <PackageIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Comece sua vitrine</h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        Cadastre seu primeiro produto. Depois você pode publicar quando
        quiser que apareça pros seus clientes.
      </p>
      <Button asChild className="mt-2">
        <Link href="/admin/produtos/novo" prefetch>
          <PlusIcon /> Cadastrar primeiro produto
        </Link>
      </Button>
    </div>
  );
}

function NoResults({ onlyPromo }: { onlyPromo: boolean }) {
  return (
    <div className="border-border/60 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <SearchXIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">
        {onlyPromo ? "Nenhum produto em promoção agora" : "Nada por aqui"}
      </h2>
      <p className="text-muted-foreground max-w-sm text-sm">
        {onlyPromo
          ? "Quando você definir um preço promocional num produto, ele aparece aqui."
          : "Tente outros termos de busca ou limpe os filtros."}
      </p>
    </div>
  );
}
