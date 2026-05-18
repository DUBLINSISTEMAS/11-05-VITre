import { z } from "zod";

import { parseTimeMinutes } from "@/lib/business-hours";

/**
 * Validação Zod do `business_hours` (ADR-0023).
 *
 * Regras (semântica):
 * - 7 chaves obrigatórias (sun..sat).
 * - shifts: 0..2 turnos por dia (turno único OU partido).
 * - opensAt / closesAt no formato HH:MM 24h.
 * - opensAt < closesAt em cada shift.
 * - Quando há 2 shifts, o 2o.opensAt > 1o.closesAt (não sobrepõe nem inverte).
 * - Quando closed=true, shifts deve ser [] (não confunde rendering).
 */

const timeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use o formato HH:MM (ex: 09:00)")
  .refine((v) => !Number.isNaN(parseTimeMinutes(v)), "Horário inválido");

const shiftSchema = z
  .object({
    opensAt: timeStringSchema,
    closesAt: timeStringSchema,
  })
  .refine(
    (s) => parseTimeMinutes(s.opensAt) < parseTimeMinutes(s.closesAt),
    { message: "Abertura precisa ser antes do fechamento", path: ["closesAt"] },
  );

const daySchema = z
  .object({
    closed: z.boolean(),
    shifts: z.array(shiftSchema).max(2, "Máximo 2 turnos por dia"),
  })
  .refine(
    (d) => !d.closed || d.shifts.length === 0,
    { message: "Dia fechado não deve ter turnos", path: ["shifts"] },
  )
  .refine(
    (d) => {
      if (d.shifts.length !== 2) return true;
      const firstEnd = parseTimeMinutes(d.shifts[0]!.closesAt);
      const secondStart = parseTimeMinutes(d.shifts[1]!.opensAt);
      return secondStart > firstEnd;
    },
    {
      message: "O 2º turno precisa começar depois do fim do 1º",
      path: ["shifts"],
    },
  );

export const businessHoursJsonSchema = z.object({
  sunday: daySchema,
  monday: daySchema,
  tuesday: daySchema,
  wednesday: daySchema,
  thursday: daySchema,
  friday: daySchema,
  saturday: daySchema,
});

export const updateBusinessHoursSchema = z.object({
  hours: businessHoursJsonSchema.nullable(),
});

export type UpdateBusinessHoursInput = z.input<typeof updateBusinessHoursSchema>;
