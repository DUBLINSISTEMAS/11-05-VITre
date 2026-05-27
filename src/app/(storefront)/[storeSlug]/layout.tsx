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
 * em `--primary` (azul fixo do Mangos Pay), promo em `rose-600`, success em
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

/**
 * Força runtime dinâmico pra TODAS as pages do storefront público.
 *
 * Sem isso, Next 15 + Turbopack tenta gerar `generateStaticParams` em
 * background (pre-render worker) pra rotas com `[storeSlug]` /
 * `[productSlug]` / `[categorySlug]`, e estoura memória do Jest worker
 * com "Failed to generate static paths" → "MemoryChunk allocation
 * failed during deserialization" (capturado pelo Monitor em
 * 2026-05-27, várias rotas).
 *
 * Storefront público é dinâmico por natureza: slug da loja, categoria,
 * produto vêm da URL, dependem do DB e mudam em tempo real (cliente
 * adiciona produto → revalidateTag invalida). Pré-render estático
 * nunca foi a estratégia — `unstable_cache` no loader + revalidate
 * 300s já provê o cache que importa.
 *
 * Aplicado no layout porque cascateia pra todo o subtree
 * `(storefront)/[storeSlug]/**`. Cada page filha herda — sem precisar
 * declarar 11 vezes.
 */
export const dynamic = "force-dynamic";

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
      `Loja online de ${store.name}. Compre via WhatsApp, sem cadastro.`,
    openGraph: {
      title: store.name,
      description: store.description ?? undefined,
      images: store.logoUrl ? [{ url: store.logoUrl }] : undefined,
      type: "website",
    },
    // Favicon Mangos Pay sempre fixo — mesmo na loja online do lojista.
    // Logo do lojista (store.logoUrl) continua aparecendo no header da loja.
    icons: {
      icon: { url: "/logos/favicon.svg", type: "image/svg+xml" },
    },
    // Sprint flash 2026-05-24 — manifest dinâmico por loja (route handler
    // em manifest.webmanifest/route.ts). Antes o storefront herdava o
    // manifest estático do admin, então "Adicionar à tela inicial" no
    // celular do cliente abria o LOGIN do admin. Agora abre a HOME da
    // loja com ícone e cor da loja.
    manifest: `/${storeSlug}/manifest.webmanifest`,
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
