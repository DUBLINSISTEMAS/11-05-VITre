/**
 * Schemas Zod para o domínio `stock_movement` (Fase 4 — ADR-0015).
 *
 * Tipos cobertos pela UI admin (lojista chama manualmente):
 *   - manual_in:   entrada manual (compra de fornecedor, devolução de cliente)
 *   - manual_out:  saída manual (perda, dano, doação)
 *   - adjustment:  ajuste de inventário (contagem física vs sistema)
 *
 * Tipos NÃO expostos no schema da action (gerados pelo sistema):
 *   - initial:     gerado em create-product ou backfill
 *   - sale:        gerado em checkout (create-from-cart)
 *   - return:      gerado em cancel/expire (restock helper)
 */
import { z } from "zod";

export const MANUAL_MOVEMENT_TYPES = [
  "manual_in",
  "manual_out",
  "adjustment",
] as const;

export const recordMovementSchema = z
  .object({
    productId: z.string().uuid("Produto inválido."),
    variantId: z
      .string()
      .uuid()
      .nullish()
      .transform((v) => v ?? null),
    movementType: z.enum(MANUAL_MOVEMENT_TYPES),
    /**
     * Quantidade SEMPRE positiva no input. O sinal é derivado do
     * movementType (manual_in = +, manual_out = -, adjustment = signed
     * via campo separado). Evita confusão "digitei -5 pra entrada".
     */
    quantity: z.coerce
      .number()
      .int("Use número inteiro.")
      .min(1, "Quantidade deve ser maior que zero.")
      .max(1_000_000, "Quantidade muito alta."),
    /**
     * Direção do ajuste (só aplicável a movementType=adjustment). Pra
     * manual_in/manual_out o sinal já é determinado pelo tipo.
     */
    adjustmentDirection: z.enum(["positive", "negative"]).optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Notas muito longas (máx 500).")
      .nullish()
      .transform((v) => {
        const t = v?.trim() ?? "";
        return t === "" ? null : t;
      }),
  })
  .refine(
    (data) =>
      data.movementType !== "adjustment" || data.adjustmentDirection !== undefined,
    {
      message: "Ajuste exige direção (entrada ou saída).",
      path: ["adjustmentDirection"],
    },
  )
  // Onda 2.5 (2026-05-22): saída manual EXIGE motivo. Sem isso, histórico
  // de estoque acumula "saiu 5 peças por quê??" sem auditoria possível
  // — virou rotina em sistema legado. Aqui validamos no boundary; helper
  // de UI sugere motivos comuns (perda, doação, brinde, ajuste, troca).
  // manual_in fica opcional (entrada já tem contexto via compra/devolução).
  // adjustment negativo idem — direção negativa é equivalente a saída.
  .refine(
    (data) => {
      const isOutflow =
        data.movementType === "manual_out" ||
        (data.movementType === "adjustment" &&
          data.adjustmentDirection === "negative");
      if (!isOutflow) return true;
      return data.notes !== null && data.notes.length >= 3;
    },
    {
      message:
        "Toda saída precisa de motivo (perda, doação, brinde, ajuste, troca, etc).",
      path: ["notes"],
    },
  );

export type RecordMovementInput = z.input<typeof recordMovementSchema>;
type RecordMovementData = z.output<typeof recordMovementSchema>;
