/**
 * Schemas Zod do domínio `category`.
 *
 * MVP: 2 níveis máximo. `parentId = null` = categoria raiz.
 * Validação de aninhamento profundo acontece no app (server action), pois
 * Postgres self-FK não impede recursão.
 */
import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome muito curto.")
    .max(60, "Nome muito longo (máx 60)."),
  /** null = raiz. UUID = filha de outra categoria desta loja. */
  parentId: z.string().uuid().nullable(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Nome muito curto.")
    .max(60, "Nome muito longo (máx 60)."),
  parentId: z.string().uuid().nullable(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const deleteCategorySchema = z.object({
  categoryId: z.string().uuid(),
});
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;

export const toggleCategoryActiveSchema = z.object({
  categoryId: z.string().uuid(),
  isActive: z.boolean(),
});
export type ToggleCategoryActiveInput = z.infer<
  typeof toggleCategoryActiveSchema
>;

export const reorderCategoriesSchema = z.object({
  /** Lista ordenada de IDs no escopo. */
  orderedIds: z.array(z.string().uuid()).min(1).max(50),
  /** null = reordenando raízes; uuid = reordenando filhas deste parent. */
  parentId: z.string().uuid().nullable(),
});
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

export const removeCategoryImageSchema = z.object({
  categoryId: z.string().uuid(),
});
export type RemoveCategoryImageInput = z.infer<
  typeof removeCategoryImageSchema
>;

/**
 * Validação do `categoryId` no upload de imagem. Schema dedicado pq o
 * payload chega via FormData (multipart), não JSON — extraímos e parseamos
 * só o campo de ID. Alinha com `uploadProductImageSchema` (defesa em
 * profundidade contra string arbitrária).
 */
export const uploadCategoryImageSchema = z.object({
  categoryId: z.string().uuid(),
});
export type UploadCategoryImageInput = z.infer<
  typeof uploadCategoryImageSchema
>;
