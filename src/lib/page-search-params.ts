/**
 * Schemas Zod reutilizáveis para `searchParams` de páginas server-side.
 *
 * Por quê:
 *   - `searchParams` é boundary externo (vem da URL do usuário). Convenção
 *     CLAUDE.md #2 manda Zod em todos os boundaries.
 *   - Antes do Bloco 2.4, cada página fazia parsing manual: `parseInt`,
 *     `.trim()`, `(VALID as readonly string[]).includes(v)`. Funcional,
 *     mas SEM caps — atacante podia mandar `?page=999999999` → offset
 *     gigante = full table scan, ou `?q=<string de 10MB>` → ilike pesado.
 *   - Centralizar em primitives evita drift e garante caps consistentes
 *     em listagens novas.
 *
 * Uso:
 *   const schema = z.object({
 *     q: searchTextSchema,
 *     page: pageNumberSchema,
 *     status: enumOrNull(["active","inactive"] as const),
 *   });
 *   const { q, page, status } = schema.parse(await searchParams);
 *
 * Todos os primitives têm default seguro — `.parse` nunca lança em URL
 * malformada (entrada vira default), eliminando try/catch boilerplate.
 */
import { z } from "zod";

/**
 * Caps deliberados — proteção contra abuso, NÃO contra usuários
 * legítimos. Page max=100k cobre catálogo de 2.4M produtos com PAGE_SIZE=24
 * (fora dos cenários MVP, mas evita full-scan de offset gigante).
 */
const MAX_PAGE = 100_000;
const MAX_QUERY_LEN = 100;
/** R$ 100k — cobre joia/semijoia premium. Filtros acima disso são
 *  improváveis e podem mascarar erro de digitação. */
const MAX_PRICE_CENTS = 100_000_00;

/**
 * `?page=N` — número inteiro ≥ 1, capped em MAX_PAGE. Default 1.
 * Aceita string (URL) ou number (programático). Strings inválidas
 * (`abc`, `-5`, vazia) viram 1.
 *
 * IMPORTANTE: `.nullish()` em Zod v4 é OBRIGATÓRIO pra schema funcionar
 * dentro de z.object() quando a propriedade pode estar ausente. Incluir
 * z.undefined() na union NÃO é equivalente — Zod v4 trata schema sem
 * .optional()/.nullish() como nonoptional e dá erro
 * "expected nonoptional, received undefined" quando o objeto pai não
 * tem a propriedade.
 */
export const pageNumberSchema = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => {
    if (v === undefined || v === null) return 1;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(Math.floor(n), MAX_PAGE);
  });

/**
 * `?q=texto` — string trimada, capped em MAX_QUERY_LEN. Default "".
 * Não escape SQL (cada call site lida com ilike/ftd próprio).
 */
export const searchTextSchema = z
  .string()
  .optional()
  .transform((v) => (v ?? "").trim().slice(0, MAX_QUERY_LEN));

/**
 * `?flag=1` — apenas a string "1" vira true. Qualquer outra coisa
 * (incluindo "true", "0", undefined) vira false. Convenção URL-friendly
 * já em uso pelo storefront e admin (`?promo=1`).
 */
export const boolFlagSchema = z
  .string()
  .optional()
  .transform((v) => v === "1");

/**
 * `?priceMin=X` / `?priceMax=X` — preço em centavos. Inválidos viram
 * undefined (sem filtro). Capped em MAX_PRICE_CENTS.
 *
 * Veja nota em `pageNumberSchema` sobre `.nullish()` ser obrigatório
 * pro schema funcionar dentro de z.object() em Zod v4.
 */
export const priceCentsSchema = z
  .string()
  .nullish()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.min(Math.round(n), MAX_PRICE_CENTS);
  });

/**
 * Whitelist de enum vinda da URL — vira `null` se não bater. Útil pra
 * filtros de status onde "sem filtro" é estado válido.
 */
export function enumOrNull<T extends readonly string[]>(values: T) {
  const set = new Set<string>(values);
  return z
    .string()
    .optional()
    .transform((v): T[number] | null =>
      v && set.has(v) ? (v as T[number]) : null,
    );
}

/**
 * Whitelist de enum com fallback — sempre retorna um valor do enum.
 * Útil para sort onde "default" é um item específico do conjunto.
 */
export function enumWithDefault<T extends readonly string[]>(
  values: T,
  fallback: T[number],
) {
  const set = new Set<string>(values);
  return z
    .string()
    .optional()
    .transform((v): T[number] => (v && set.has(v) ? (v as T[number]) : fallback));
}

/**
 * `?id=uuid` — string trimada não-vazia, ou null.
 *
 * Auditoria I10 (2026-05-12): valida formato UUID (qualquer versão).
 * Antes, malformed `?categoryId=foo` chegava no WHERE e Postgres lançava
 * `invalid input syntax for type uuid` → 500 + Sentry noise. Agora vira
 * `null` silencioso (sem filtro), comportamento previsível pra clientes
 * que mexem na URL manualmente.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idOrNullSchema = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    if (!t) return null;
    return UUID_REGEX.test(t) ? t : null;
  });

/**
 * `?de=YYYY-MM-DD` / `?ate=YYYY-MM-DD` — data ISO sem timezone.
 *
 * Retorna `Date` (UTC à meia-noite) ou `null` se inválido. Não aceita
 * timestamp completo (sem hora) — listagens diárias usam dia-cheio.
 * Use junto com `endOfDay()` no caller pro fim do range.
 *
 * Onda 1.4 (2026-05-22) — filtro de data na listagem de vendas.
 */
const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const dateOrNullSchema = z
  .string()
  .optional()
  .transform((v): Date | null => {
    const t = v?.trim();
    if (!t || !DATE_ISO_REGEX.test(t)) return null;
    const d = new Date(`${t}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  });
