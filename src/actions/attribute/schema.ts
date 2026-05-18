import { z } from "zod";

export const attributeTypeSchema = z.enum(["color", "size", "text"]);

export const upsertAttributeSchema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(1, "Nome obrigatório").max(60, "Máx 60 caracteres"),
  type: attributeTypeSchema,
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const deleteAttributeSchema = z.object({
  id: z.string().uuid(),
});

export const upsertAttributeValueSchema = z.object({
  id: z.string().uuid().nullable(),
  attributeId: z.string().uuid(),
  label: z.string().min(1, "Label obrigatório").max(60, "Máx 60 caracteres"),
  colorHex: z
    .string()
    .max(40)
    .nullable()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  position: z.number().int().min(0).default(0),
});

export const deleteAttributeValueSchema = z.object({
  id: z.string().uuid(),
});

export const setProductAttributeValuesSchema = z.object({
  productId: z.string().uuid(),
  attributeValueIds: z.array(z.string().uuid()),
});

export type UpsertAttributeInput = z.input<typeof upsertAttributeSchema>;
export type UpsertAttributeValueInput = z.input<typeof upsertAttributeValueSchema>;
