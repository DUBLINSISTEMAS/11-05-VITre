/**
 * robots.txt — permite tudo, aponta sitemap.
 *
 * Bloqueamos /admin (não é pra ser indexado) e /api por convenção.
 */
import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/criar-loja",
          "/entrar",
          "/recuperar",
          "/redefinir",
          // /p/[token] = pedido individual (publicToken opaco); cliente
          // pode compartilhar o link, mas Google não deve indexar.
          "/p/",
          // /[storeSlug]/sucesso e /[storeSlug]/sacola: evitar indexação
          // (`noindex` no metadata cobre, mas robots.txt é defesa em
          // profundidade pra crawlers que ignoram meta).
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
