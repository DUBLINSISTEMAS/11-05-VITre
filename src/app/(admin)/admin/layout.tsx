import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/shell/admin-shell";
import { productTable } from "@/db/schema";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";
import { withTenant } from "@/lib/tenant";

/**
 * Layout do painel admin.
 * - Guarda de auth: `requireSession()` redireciona para /entrar se sem login.
 * - Guarda de loja: redireciona para /criar-loja/identidade se logado mas sem loja.
 * - Aplica AdminShell (header + bottom nav + ornamento de fundo) em todas as páginas.
 *
 * `getCurrentStore` usa `cache()` para evitar query duplicada quando páginas
 * filhas precisam da loja.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) redirect("/criar-loja/identidade");

  // Onda L5 (2026-05-29) — opt-in da Loja online no sidebar.
  // Conta produtos publicados pra decidir se o grupo "Loja online" abre
  // ou colapsa por default. Sem produto publicado = lojista nao usa
  // storefront ainda, grupo polui o dia-a-dia. Query barata via index
  // (store_id + is_published_to_storefront).
  const hasStorefront = await withTenant(
    store.id,
    session.user.id,
    async (tx) => {
      const [row] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(productTable)
        .where(
          and(
            eq(productTable.storeId, store.id),
            eq(productTable.isPublishedToStorefront, true),
            eq(productTable.isActive, true),
          ),
        )
        .limit(1);
      return (row?.n ?? 0) > 0;
    },
  );

  return (
    <AdminShell
      ownerName={session.user.name}
      ownerEmail={session.user.email}
      storeName={store.name}
      storeSlug={store.slug}
      primaryColor={store.primaryColor}
      logoUrl={store.logoUrl}
      hasStorefront={hasStorefront}
    >
      {children}
    </AdminShell>
  );
}
