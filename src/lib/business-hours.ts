/**
 * Helpers de horários da loja (ADR-0023).
 *
 * Source-of-truth do formato é `BusinessHoursJson` em `db/schema/store.ts`.
 * Helpers daqui assumem que a entrada já foi validada por Zod (não revalidam).
 */

import type {
  BusinessHoursDay,
  BusinessHoursJson,
  BusinessHoursShift,
} from "@/db/schema/store";

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const satisfies readonly (keyof BusinessHoursJson)[];

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABEL_SHORT: Record<WeekdayKey, string> = {
  sunday: "Dom",
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
};

export const WEEKDAY_LABEL_LONG: Record<WeekdayKey, string> = {
  sunday: "Domingo",
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
};

/** Default 100% vazio (todos os 7 dias `closed=false, shifts=[]`). */
export function emptyBusinessHours(): BusinessHoursJson {
  return {
    sunday: { closed: false, shifts: [] },
    monday: { closed: false, shifts: [] },
    tuesday: { closed: false, shifts: [] },
    wednesday: { closed: false, shifts: [] },
    thursday: { closed: false, shifts: [] },
    friday: { closed: false, shifts: [] },
    saturday: { closed: false, shifts: [] },
  };
}

/** Default razoável: seg-sex 09-18, sáb 09-13, dom fechado. */
export function defaultBusinessHours(): BusinessHoursJson {
  const weekday: BusinessHoursDay = {
    closed: false,
    shifts: [{ opensAt: "09:00", closesAt: "18:00" }],
  };
  return {
    sunday: { closed: true, shifts: [] },
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: { closed: false, shifts: [{ opensAt: "09:00", closesAt: "13:00" }] },
  };
}

/** Converte "HH:MM" em minutos desde 00:00. Retorna NaN se inválido. */
export function parseTimeMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return Number.NaN;
  const h = Number.parseInt(match[1]!, 10);
  const m = Number.parseInt(match[2]!, 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
}

/** "09:00" → "09h". "09:30" → "09h30". */
export function formatShiftLabel(shift: BusinessHoursShift): string {
  return `${formatTimeLabel(shift.opensAt)} às ${formatTimeLabel(shift.closesAt)}`;
}

function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  if (!h) return hhmm;
  return m === "00" ? `${h}h` : `${h}h${m}`;
}

/**
 * Resumo textual de 1 dia. Usado em status badge + footer storefront.
 *
 *   "Fechado"                               quando closed=true
 *   "Consulte"                              quando shifts=[]
 *   "09h às 18h"                            1 shift
 *   "09h às 12h · 14h às 18h"               2 shifts (turno partido)
 */
export function formatDaySummary(day: BusinessHoursDay): string {
  if (day.closed) return "Fechado";
  if (day.shifts.length === 0) return "Consulte";
  return day.shifts.map(formatShiftLabel).join(" · ");
}

/**
 * "Está aberto agora?" — dada uma config + um Date local, retorna se a loja
 * está dentro de algum shift do dia atual. NÃO faz timezone math; assume
 * que `now` já está no fuso correto (server-side: usar Date no horário de
 * Brasília; client-side: Date local do browser).
 */
export function isOpenNow(hours: BusinessHoursJson | null, now: Date): boolean {
  if (!hours) return false;
  const key = WEEKDAY_KEYS[now.getDay()]!;
  const day = hours[key];
  if (day.closed || day.shifts.length === 0) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return day.shifts.some((shift) => {
    const o = parseTimeMinutes(shift.opensAt);
    const c = parseTimeMinutes(shift.closesAt);
    if (Number.isNaN(o) || Number.isNaN(c)) return false;
    return minutesNow >= o && minutesNow < c;
  });
}
