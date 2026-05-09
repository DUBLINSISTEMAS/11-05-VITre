/**
 * Schemas Zod do domínio `banner`. Banners são imagens da home da loja
 * (tipo carrossel de promoção). Position controla ordem; isActive
 * permite "esconder" sem deletar.
 */
import { z } from "zod";

export const createBannerSchema = z.object({
  /**
   * URL absoluta. Aceita externa (Instagram, WhatsApp) ou relativa do
   * próprio storefront (ex: `/produtos/vestido-x`). Vazio = sem link
   * (banner decorativo).
   */
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine(
      (v) =>
        v === null ||
        v === "" ||
        v.startsWith("/") ||
        /^https?:\/\//i.test(v),
      "Use um link começando com http(s)://, ou um caminho começando com /.",
    ),
});
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z.object({
  bannerId: z.string().uuid(),
  link: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .refine(
      (v) =>
        v === null ||
        v === "" ||
        v.startsWith("/") ||
        /^https?:\/\//i.test(v),
      "Use um link começando com http(s)://, ou um caminho começando com /.",
    ),
});
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

export const deleteBannerSchema = z.object({
  bannerId: z.string().uuid(),
});
export type DeleteBannerInput = z.infer<typeof deleteBannerSchema>;

export const toggleBannerActiveSchema = z.object({
  bannerId: z.string().uuid(),
  isActive: z.boolean(),
});
export type ToggleBannerActiveInput = z.infer<typeof toggleBannerActiveSchema>;

export const reorderBannersSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(20),
});
export type ReorderBannersInput = z.infer<typeof reorderBannersSchema>;
