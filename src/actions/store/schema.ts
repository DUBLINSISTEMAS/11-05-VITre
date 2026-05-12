/**
 * Schemas Zod para o domínio `store`.
 */
import { z } from "zod";

import { isValidHexColor } from "@/lib/brand";
import { NICHE_OPTIONS } from "@/lib/niche-categories";
import { isReservedSlug, isValidSlugFormat } from "@/lib/slug";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

const nicheValues = NICHE_OPTIONS.map((n) => n.value) as [string, ...string[]];

export const storeSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlugFormat, {
    message:
      "Use letras minúsculas, números e hífen. Mín 3, máx 40 caracteres.",
  })
  .refine((s) => !isReservedSlug(s), {
    message: "Esse endereço é reservado. Escolha outro.",
  });

export const createStoreSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome muito curto")
    .max(80, "Nome muito longo"),
  slug: storeSlugSchema,
  niche: z.enum(nicheValues),
  whatsappNumber: z
    .string()
    .trim()
    .refine(isValidWhatsAppBR, "Número de WhatsApp inválido."),
  primaryColor: z
    .string()
    .trim()
    .refine(isValidHexColor, "Cor inválida. Use formato #RRGGBB."),
  addressCity: z.string().trim().max(80).optional().or(z.literal("")),
  addressState: z
    .string()
    .trim()
    .max(2, "Use 2 letras (ex: MA)")
    .optional()
    .or(z.literal("")),
  /**
   * Opt-in: cria categorias sugeridas do nicho (Vestidos, Anéis, etc).
   * Default true preserva comportamento histórico. Lojista pode desligar
   * pra começar com categoria vazia e nomear as próprias.
   *
   * `.default()` faz o campo ser OPCIONAL na entrada (form/client) e
   * REQUIRED na saída (action recebe boolean garantido). Por isso o
   * form usa `z.input<>` e a action usa `z.infer<>` — divergência
   * documentada em team memory `zod-action-input-type-with-defaults.md`.
   */
  includeNicheCategories: z.boolean().default(true),
});
/**
 * Tipo do form (client) — `.default()` faz o campo virar opcional aqui.
 * Use em `useForm<CreateStoreInput>` e nos handlers do RHF.
 */
export type CreateStoreInput = z.input<typeof createStoreSchema>;
/**
 * Tipo da action (server, pós-`parse`) — todos os campos resolvidos.
 * Use no parâmetro de `createStore` e no parsed local.
 */
export type CreateStoreData = z.infer<typeof createStoreSchema>;

export const checkSlugSchema = z.object({
  slug: z.string().trim().toLowerCase(),
});
export type CheckSlugInput = z.infer<typeof checkSlugSchema>;

/**
 * Schema do form de configurações da loja. Edita campos textuais de
 * `storeTable` exceto `slug`, `ownerId`, `logoUrl`, `iconUrl`,
 * `primaryColor`, `bannerRotationSec` e timestamps. Slug é fixo (URL
 * pública estável); logos+cor+banner ficaram em Aparência (Onda 3 do
 * pacote master 2026-05-12).
 */
export const updateStoreSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .max(500, "Descrição muito longa (máx 500).")
    .nullable(),
  niche: z.enum(nicheValues),
  whatsappNumber: z
    .string()
    .trim()
    .refine(isValidWhatsAppBR, "Número de WhatsApp inválido."),
  addressStreet: z.string().trim().max(120).nullable(),
  addressNumber: z.string().trim().max(20).nullable(),
  addressNeighborhood: z.string().trim().max(80).nullable(),
  addressCity: z.string().trim().max(80).nullable(),
  addressState: z
    .string()
    .trim()
    .max(2, "Use 2 letras (ex: MA).")
    .nullable()
    .refine((v) => v === null || v === "" || /^[A-Za-z]{2}$/.test(v), {
      message: "Use 2 letras (ex: MA).",
    }),
  googleMapsUrl: z
    .string()
    .trim()
    .nullable()
    .refine(
      (v) => v === null || v === "" || /^https?:\/\//i.test(v),
      "Cole o link completo do Google Maps (deve começar com http).",
    ),
  instagramHandle: z
    .string()
    .trim()
    .max(40, "Usuário muito longo (máx 40).")
    .nullable(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

/**
 * Schema do form de Aparência (cor primária + rotação banner).
 * Logo e ícone têm upload separado (StoreImageUploader). Onda 3.
 */
export const updateAppearanceSchema = z.object({
  primaryColor: z
    .string()
    .trim()
    .refine(isValidHexColor, "Cor inválida. Use formato #RRGGBB."),
  /**
   * Intervalo de rotação do carrossel de banners no storefront.
   * 0 = desligado (mostra só o primeiro banner ativo).
   * 3-60s = rotação automática. Default 5s no schema.
   */
  bannerRotationSec: z
    .number()
    .int("Use um número inteiro.")
    .refine((v) => v === 0 || (v >= 3 && v <= 60), {
      message: "Use 0 (desligado) ou entre 3 e 60 segundos.",
    }),
});
export type UpdateAppearanceInput = z.infer<typeof updateAppearanceSchema>;

export const uploadStoreImageSchema = z.object({
  kind: z.enum(["logo", "icon"]),
});
export type UploadStoreImageInput = z.infer<typeof uploadStoreImageSchema>;

export const removeStoreImageSchema = z.object({
  kind: z.enum(["logo", "icon"]),
});
export type RemoveStoreImageInput = z.infer<typeof removeStoreImageSchema>;

/**
 * Schema da action `applyTheme` — Onda C.
 * `presetId` deve bater com uma chave de THEME_PRESETS. Lista hardcoded
 * aqui pra evitar import cíclico (themes.ts é client-safe).
 */
export const applyThemeSchema = z.object({
  presetId: z.enum(["vitre-clean", "boutique", "bazar"]),
});
export type ApplyThemeInput = z.infer<typeof applyThemeSchema>;
