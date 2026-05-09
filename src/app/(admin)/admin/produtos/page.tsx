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
import {
  PackageIcon,
  PlusIcon,
  SearchXIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import type { CategoryOption } from "@/components/admin/category-dialog";
import { ProductsFilters } from "@/components/admin/products-filters";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import {
  categoryTable,
  productImageTable,
  productTable,
} from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { formatPriceLabel, hasActivePromo } from "@/lib/pricing";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

const PAGE_SIZE = 20;

interface ProdutosPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    promo?: string;
    page?: string;
  }>;
}

/**
 * Lista de produtos do admin — versão C.2.
 *
 * Filtros via `searchParams` (URL é fonte da verdade):
 *  - `q` busca por nome (`ILIKE %q%`, wildcards do user escapados)
 *  - `categoryId` filtra por categoria
 *  - `status` "active" | "inactive"
 *  - `promo` "1" — só produtos com promoção válida agora
 *  - `page` 1-indexed, page size = 20
 *
 * Paginação offset (cabe no MVP da Sandra com até ~50 produtos; cursor
 * pode ser refatorado se passar de 10k linhas). Conta total + slice em
 * `Promise.all` pra não serializar 2 queries.
 */
export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: produtos page sem loja");
  }

  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryId = params.categoryId?.trim() || null;
  const statusFilter = params.status ?? null;
  const onlyPromo = params.promo === "1";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // ---- WHERE dinâmico ----
  const conditions: SQL[] = [eq(productTable.storeId, store.id)];
  if (q) {
    // Escape wildcards do LIKE: usuário digita "50%" sem virar "match qualquer".
    const safeQ = q.replace(/[\\%_]/g, "\\$&");
    conditions.push(ilike(productTable.name, `%${safeQ}%`));
  }
  if (categoryId) {
    conditions.push(eq(productTable.categoryId, categoryId));
  }
  if (statusFilter === "active") {
    conditions.push(eq(productTable.isActive, true));
  } else if (statusFilter === "inactive") {
    conditions.push(eq(productTable.isActive, false));
  }
  if (onlyPromo) {
    // Promoção válida agora: tem promoPrice E (start null OR start <= now) E
    // (end null OR end >= now). `now()` server-side garante consistência.
    const now = sql`now()`;
    conditions.push(isNotNull(productTable.promoPriceInCents));
    const startCond = or(
      isNull(productTable.promoStartsAt),
      lte(productTable.promoStartsAt, now),
    );
    const endCond = or(
      isNull(productTable.promoEndsAt),
      gte(productTable.promoEndsAt, now),
    );
    if (startCond) conditions.push(startCond);
    if (endCond) conditions.push(endCond);
  }
  const whereClause = and(...conditions);

  // ---- Fetch paralelo: lista + total + categorias da loja + capas ----
  const offset = (page - 1) * PAGE_SIZE;
  const { products, total, categories, coversByProduct } = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      const [products, totalRows, categories] = await Promise.all([
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
          },
        }),
        tx.select({ value: count() }).from(productTable).where(whereClause),
        tx.query.categoryTable.findMany({
          where: eq(categoryTable.storeId, store.id),
          orderBy: [asc(categoryTable.position), asc(categoryTable.name)],
          columns: { id: true, name: true, parentId: true },
        }),
      ]);

      // Capa de cada produto em UMA query batch (position 0).
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
      };
    },
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filterCategories: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));

  const hasFilters =
    q !== "" ||
    !!categoryId ||
    statusFilter === "active" ||
    statusFilter === "inactive" ||
    onlyPromo;

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Produtos
          </h1>
          <p className="text-muted-foreground text-sm">
            {renderCountLabel(total, hasFilters)}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/produtos/novo">
            <PlusIcon /> <span className="hidden sm:inline">Novo produto</span>
          </Link>
        </Button>
      </header>

      <ProductsFilters categories={filterCategories} />

      {products.length === 0 ? (
        hasFilters ? (
          <NoResults onlyPromo={onlyPromo} />
        ) : (
          <EmptyState />
        )
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const cover = coversByProduct.get(p.id);
              const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
              const onPromoNow = hasActivePromo(p);
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/produtos/${p.id}/editar`}
                    className="bg-background/50 hocus:bg-background hocus:shadow-brand-sm group flex items-center gap-3 rounded-xl border p-3 outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <PackageIcon className="text-muted-foreground size-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate font-medium">
                        {isDraft ? (
                          <span className="text-muted-foreground italic">
                            Rascunho sem nome
                          </span>
                        ) : (
                          p.name
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatPriceLabel(p)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={
                            p.isActive
                              ? "bg-primary/10 text-primary inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                              : "bg-muted text-muted-foreground inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
                          }
                        >
                          {p.isActive ? "Visível" : "Pausado"}
                        </span>
                        {onPromoNow ? (
                          <span className="bg-warning-soft text-warning-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
                            <SparklesIcon className="size-2.5" /> Promo
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

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
