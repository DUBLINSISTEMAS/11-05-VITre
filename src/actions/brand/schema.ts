/**
 * Schemas Zod do domínio brand (Sprint 2A).
 *
 * Slug auto-gerado a partir do name se não fornecido. Aceita override
 * manual quando lojista quer URL específica.
 */
import { z } from "zod";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const upsertBrandSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Nome obrigatório").max(80),
  slug: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z
        .string()
        .trim()
        .max(60, "Slug muito longo")
        .regex(SLUG_RE, "Slug só aceita letras minúsculas, números e hífens")
        .nullable(),
    )
    .default(null),
});
export type UpsertBrandInput = z.input<typeof upsertBrandSchema>;

export const deleteBrandSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Audit 2026-05-26 — slug agora delegado pro `generateSlug` canônico em
 * `lib/slug.ts`. Antes essa função reimplementava NFD + replace manual e
 * podia divergir do storefront (que usa o pacote `slugify` com locale pt).
 * Re-export pra preservar callers existentes (action/brand/index importa
 * pelo nome `slugifyBrand`).
 */
import { generateSlug } from "@/lib/slug";

export function slugifyBrand(name: string): string {
  return generateSlug(name).slice(0, 60);
}
