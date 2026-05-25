/**
 * Manifest PWA dinâmico por loja.
 *
 * Sprint flash 2026-05-24 — bug crítico do storefront: antes o storefront
 * herdava o manifest estático de `public/manifest.webmanifest` que aponta
 * pra `/admin` ("Mangos Pay — Gestão"). Cliente final abria
 * `loja-da-sandra.mangospay.app` no Chrome Android → "Adicionar à tela
 * inicial" → instalava → ícone abria LOGIN do admin. Destruía o moat
 * estratégico (storefront instalável como app da loja).
 *
 * Agora cada loja tem seu próprio manifest sob `/{storeSlug}/manifest.webmanifest`,
 * apontando pra HOME pública da loja, com nome/cor/ícone da loja.
 *
 * O `<link rel="manifest">` é injetado pelo `generateMetadata` do
 * layout `(storefront)/[storeSlug]/layout.tsx` via `metadata.manifest`.
 */
import { NextResponse } from "next/server";

import { getStoreBySlug } from "@/lib/storefront/store-loader";

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: "any" | "maskable";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Logo da loja vira ícone do PWA quando configurado. Sem logo, cai
  // pros ícones default Mangos Pay (genérico é melhor que ícone do
  // admin no celular do cliente).
  //
  // Quando lojista subir logo, recomendar quadrado ≥ 512×512 nas docs
  // futuras. Por enquanto declaramos ambos tamanhos apontando pro mesmo
  // arquivo — browser escolhe o melhor.
  const icons: ManifestIcon[] = store.logoUrl
    ? [
        { src: store.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: store.logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ];

  const safeName = store.name.trim();
  const shortName =
    safeName.length > 12 ? safeName.slice(0, 12).trim() : safeName;

  const body = {
    name: safeName,
    short_name: shortName,
    description: `Loja online de ${safeName}. Combine pelo WhatsApp.`,
    id: `/${store.slug}`,
    start_url: `/${store.slug}`,
    scope: `/${store.slug}`,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: store.primaryColor,
    lang: "pt-BR",
    categories: ["shopping"],
    icons,
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Cache curto no edge — manifest muda quando lojista troca logo/cor.
      // revalidateTag(`store-${slug}`) invalida o getStoreBySlug; aqui só
      // garantimos que o browser não cacheia agressivamente.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
