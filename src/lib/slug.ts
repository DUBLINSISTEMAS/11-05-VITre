/**
 * Geração e validação de slugs para o Vitrê.
 *
 * - Slug de loja é PARTE DA URL pública (`vitre.app/[storeSlug]`).
 * - Slug de categoria/produto é único POR LOJA.
 *
 * Regras: lowercase, 3-40 chars, apenas a-z 0-9 e hífen, não começa/termina com hífen.
 */
import slugify from "slugify";

/**
 * Palavras reservadas — não podem ser slug de loja porque conflitariam com rotas.
 * Ver ADR-0004 (path-based routing).
 */
export const RESERVED_SLUGS = new Set<string>([
  "admin",
  "api",
  "app",
  "assets",
  "auth",
  "blog",
  "buscar",
  "cadastrar",
  "categoria",
  "checkout",
  "criar-loja",
  "dashboard",
  "docs",
  "entrar",
  "favicon",
  "health",
  "lib",
  "login",
  "logout",
  "metrics",
  "p",
  "precos",
  "pricing",
  "privacidade",
  "privacy",
  "produto",
  "public",
  "recuperar",
  "redefinir",
  "robots",
  "sacola",
  "sair",
  "signup",
  "sitemap",
  "sobre",
  "static",
  "status",
  "store",
  "storefront",
  "stores",
  "support",
  "suporte",
  "terms",
  "termos",
  "vitre",
  "www",
  "_next",
  "_legacy",
]);

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function generateSlug(input: string): string {
  return slugify(input, {
    lower: true,
    strict: true, // remove caracteres não-alfanuméricos exceto hífen
    trim: true,
    locale: "pt",
  }).replace(/-+/g, "-");
}

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export type SlugRejectionReason =
  | "format"
  | "reserved"
  | "taken";

export interface SlugValidation {
  ok: boolean;
  reason?: SlugRejectionReason;
}

/**
 * Validação síncrona (formato + reservado). Disponibilidade no banco é checada
 * separadamente via server action `checkSlugAvailability`.
 */
export function validateSlugSync(slug: string): SlugValidation {
  if (!isValidSlugFormat(slug)) return { ok: false, reason: "format" };
  if (isReservedSlug(slug)) return { ok: false, reason: "reserved" };
  return { ok: true };
}
