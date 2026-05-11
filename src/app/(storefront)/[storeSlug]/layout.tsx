/**
 * Layout do storefront público de uma loja.
 *
 * Server Component:
 *  - Resolve a loja via `getStoreBySlug` (cached por tag store-${slug}).
 *  - 404 se loja não existe ou está inativa.
 *  - Carrega árvore de categorias pra sidebar drill-down (cached).
 *  - Monta shell (header + main + bottom-nav + footer) via `StoreShell`.
 *
 * Brand color: passada como prop pro shell, que injeta `--brand-store`
 * no wrapping div via inline style server-side (ADR-0011). Escopo
 * restrito: bottom-nav + badge da sacola. CTAs/promo/focus rings ficam
 * em `--primary` (Vitrê azul fixo), promo em `rose-600`, success em
 * `--success`. Sem CSS-in-JS runtime, sem hydration mismatch.
 *
 * Brand contained: storefront tem header próprio, sem ReactQueryProvider
 * do admin (não precisa). Carrinho (Fase 1.6) usa localStorage, não
 * React Query.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreShell } from "@/components/storefront/store-shell";
import { getCategoryTree } from "@/lib/storefront/categories-loader";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Loja não encontrada" };

  return {
    title: {
      default: store.name,
      template: `%s · ${store.name}`,
    },
    description:
      store.description ??
      `Vitrine digital de ${store.name}. Compre via WhatsApp, sem cadastro.`,
    openGraph: {
      title: store.name,
      description: store.description ?? undefined,
      images: store.logoUrl ? [{ url: store.logoUrl }] : undefined,
      type: "website",
    },
    icons: store.iconUrl
      ? { icon: store.iconUrl }
      : { icon: "/brand/icone-branco.webp" },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const categoryTree = await getCategoryTree(store.id, store.slug);

  return (
    <StoreShell store={store} categoryTree={categoryTree}>
      {children}
    </StoreShell>
  );
}
