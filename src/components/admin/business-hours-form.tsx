"use client";

import { CopyIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateBusinessHours } from "@/actions/store/business-hours/update";
import type { BusinessHoursJson } from "@/db/schema/store";
import {
  defaultBusinessHours,
  emptyBusinessHours,
  WEEKDAY_KEYS,
  WEEKDAY_LABEL_LONG,
  type WeekdayKey,
} from "@/lib/business-hours";

/**
 * Card "Horários de funcionamento" (ADR-0023).
 *
 * Layout: lista de 7 dias com toggle Aberto/Fechado + até 2 turnos por dia.
 * Botão "Copiar para todos" replica os shifts do dia atual nos outros 6.
 * Botão "Limpar tudo" zera (volta a NULL no DB).
 */
export function BusinessHoursForm({
  initialHours,
}: {
  initialHours: BusinessHoursJson | null;
}) {
  const [hours, setHours] = useState<BusinessHoursJson>(
    initialHours ?? emptyBusinessHours(),
  );
  const [hasValue, setHasValue] = useState(initialHours !== null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function patchDay(key: WeekdayKey, patch: Partial<BusinessHoursJson[WeekdayKey]>) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
    setHasValue(true);
  }

  function addShift(key: WeekdayKey) {
    const current = hours[key];
    if (current.shifts.length >= 2) return;
    const next = current.shifts.length === 0
      ? [{ opensAt: "09:00", closesAt: "18:00" }]
      : [...current.shifts, { opensAt: "14:00", closesAt: "18:00" }];
    patchDay(key, { shifts: next, closed: false });
  }

  function removeShift(key: WeekdayKey, idx: number) {
    const next = hours[key].shifts.filter((_, i) => i !== idx);
    patchDay(key, { shifts: next });
  }

  function updateShift(
    key: WeekdayKey,
    idx: number,
    field: "opensAt" | "closesAt",
    value: string,
  ) {
    const next = hours[key].shifts.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s,
    );
    patchDay(key, { shifts: next });
  }

  function copyToAll(sourceKey: WeekdayKey) {
    const source = hours[sourceKey];
    setHours((prev) => {
      const next = { ...prev };
      for (const k of WEEKDAY_KEYS) {
        if (k === sourceKey) continue;
        next[k] = {
          closed: source.closed,
          shifts: source.shifts.map((s) => ({ ...s })),
        };
      }
      return next;
    });
    toast.success(`Horário de ${WEEKDAY_LABEL_LONG[sourceKey].toLowerCase()} copiado pros outros dias.`);
  }

  function loadDefault() {
    setHours(defaultBusinessHours());
    setHasValue(true);
  }

  function clearAll() {
    setHours(emptyBusinessHours());
    setHasValue(false);
  }

  function onSubmit() {
    setErrors({});
    startTransition(async () => {
      const res = await updateBusinessHours({ hours: hasValue ? hours : null });
      if (res.ok) {
        toast.success("Horários salvos.");
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="b3-card b3-card-pad">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-ink-1 text-[16px] font-bold">
            Horários de funcionamento
          </h3>
          <p className="text-ink-3 mt-1 text-[13px] leading-relaxed">
            Exibido no storefront e na página de produto. Deixe em branco
            para não mostrar.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadDefault}
            className="b3-btn b3-btn--sm"
            disabled={isPending}
          >
            Usar sugestão
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="b3-btn b3-btn--sm"
            disabled={isPending}
          >
            Limpar tudo
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {WEEKDAY_KEYS.map((key) => (
          <DayRow
            key={key}
            dayKey={key}
            day={hours[key]}
            onToggleClosed={(closed) =>
              patchDay(key, { closed, shifts: closed ? [] : hours[key].shifts })
            }
            onAddShift={() => addShift(key)}
            onRemoveShift={(idx) => removeShift(key, idx)}
            onUpdateShift={(idx, field, value) =>
              updateShift(key, idx, field, value)
            }
            onCopyToAll={() => copyToAll(key)}
          />
        ))}
      </div>

      {errors.hours && (
        <p
          className="mt-3 text-[12px]"
          style={{ color: "var(--danger)" }}
        >
          {errors.hours}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className="b3-btn b3-btn--cta"
          style={{ height: 40 }}
        >
          {isPending ? "Salvando…" : "Salvar horários"}
        </button>
      </div>
    </div>
  );
}

function DayRow({
  dayKey,
  day,
  onToggleClosed,
  onAddShift,
  onRemoveShift,
  onUpdateShift,
  onCopyToAll,
}: {
  dayKey: WeekdayKey;
  day: BusinessHoursJson[WeekdayKey];
  onToggleClosed: (closed: boolean) => void;
  onAddShift: () => void;
  onRemoveShift: (idx: number) => void;
  onUpdateShift: (
    idx: number,
    field: "opensAt" | "closesAt",
    value: string,
  ) => void;
  onCopyToAll: () => void;
}) {
  return (
    <div
      className="border-line flex flex-wrap items-center gap-3 rounded-[10px] border px-3 py-2.5"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="w-[120px] shrink-0">
        <span className="text-ink-1 text-[13px] font-semibold">
          {WEEKDAY_LABEL_LONG[dayKey]}
        </span>
      </div>

      <label className="flex shrink-0 items-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={day.closed}
          onChange={(e) => onToggleClosed(e.target.checked)}
          className="b3-checkbox-box"
        />
        <span className="text-ink-3">Fechado</span>
      </label>

      {!day.closed && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {day.shifts.map((shift, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="time"
                value={shift.opensAt}
                onChange={(e) => onUpdateShift(idx, "opensAt", e.target.value)}
                className="b3-input mono"
                style={{ width: 96, height: 30, fontSize: 12.5 }}
              />
              <span className="text-ink-4 text-[12px]">às</span>
              <input
                type="time"
                value={shift.closesAt}
                onChange={(e) => onUpdateShift(idx, "closesAt", e.target.value)}
                className="b3-input mono"
                style={{ width: 96, height: 30, fontSize: 12.5 }}
              />
              <button
                type="button"
                onClick={() => onRemoveShift(idx)}
                className="text-ink-4 hover:text-danger p-1"
                title="Remover turno"
              >
                <XIcon size={13} />
              </button>
            </div>
          ))}

          {day.shifts.length < 2 && (
            <button
              type="button"
              onClick={onAddShift}
              className="text-ink-3 hover:text-brand flex items-center gap-1 text-[12px]"
            >
              <PlusIcon size={12} />
              {day.shifts.length === 0 ? "Adicionar horário" : "Adicionar 2º turno"}
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onCopyToAll}
        className="text-ink-4 hover:text-brand ml-auto flex shrink-0 items-center gap-1 text-[11.5px]"
        title="Copiar este horário para os outros dias"
      >
        <CopyIcon size={11} />
        Copiar
      </button>
    </div>
  );
}
