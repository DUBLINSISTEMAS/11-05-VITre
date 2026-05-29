"use client";

/**
 * Sprint 3C — formulário de contagem física em batch.
 *
 * Fluxo:
 *   1. Lojista digita o número CONTADO em cada produto/variante
 *   2. Tabela mostra a diferença (delta = contado - sistema) em tempo real
 *   3. Submit envia só linhas digitadas (linhas em branco ficam fora)
 *   4. Resultado mostra X ajustes criados + Y sem diferença
 *
 * Atalhos: Enter pula pra próxima linha; busca por nome/código filtra
 * em memória (front-end, dataset limitado a 1500 linhas).
 *
 * Append-only: cada linha submetida com delta != 0 gera um
 * stock_movement type='adjustment' — saldo no sistema NUNCA é
 * sobrescrito, sempre derivado da soma de movements.
 */

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  Loader2Icon,
  MinusIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { recordPhysicalInventory } from "@/actions/stock/record-physical-inventory";
import type { CountableInventoryRow } from "@/actions/stock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PhysicalInventoryFormProps {
  items: CountableInventoryRow[];
}

interface EntryState {
  /** Texto cru do input. "" = ainda não contou; "0" = contou e tem zero. */
  raw: string;
}

function rowKey(r: CountableInventoryRow): string {
  return r.variantId ? `${r.productId}::${r.variantId}` : r.productId;
}

function parseCountInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 999_999) return null;
  return n;
}

/**
 * Bloco G UX (2026-05-29) — chave de localStorage pra auto-save de
 * rascunho. Contagem em loja média leva 1-2h; sem isso, lojista
 * interrompido por cliente perde tudo.
 *
 * Sufixo da chave fica como `physical-inventory-draft:v1`; mudou de schema
 * (ex: novos campos no EntryState), sobe pra `:v2` pra invalidar rascunhos
 * antigos sem dores.
 */
const DRAFT_KEY = "mangos:physical-inventory-draft:v1";
const DRAFT_TTL_HOURS = 24;
const DRAFT_DEBOUNCE_MS = 1000;

interface DraftPayload {
  entries: Record<string, EntryState>;
  notes: string;
  savedAt: number; // epoch ms
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function PhysicalInventoryForm({ items }: PhysicalInventoryFormProps) {
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const restoredRef = useRef(false);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bloco G UX (2026-05-29) — restore do rascunho no mount UMA VEZ.
  // Lê localStorage; se válido (< 24h) e tem entries, popula + toast.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftPayload;
      if (!parsed || typeof parsed.savedAt !== "number") return;
      const ageHours = (Date.now() - parsed.savedAt) / (1000 * 60 * 60);
      if (ageHours > DRAFT_TTL_HOURS) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const entryCount = Object.values(parsed.entries ?? {}).filter(
        (e) => (e?.raw ?? "").trim() !== "",
      ).length;
      if (entryCount === 0) return;
      setEntries(parsed.entries);
      setNotes(parsed.notes ?? "");
      toast.info(
        `Rascunho de ${formatTime(parsed.savedAt)} restaurado (${entryCount} ${entryCount === 1 ? "item" : "itens"} contados). Limpe a contagem se quiser começar do zero.`,
        { duration: 6000 },
      );
    } catch {
      // localStorage corrompido — limpa silenciosamente
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* noop */
      }
    }
  }, []);

  // Bloco G UX (2026-05-29) — auto-save debounced 1s. Save NÃO acontece
  // se entries e notes estão ambos vazios (evita lixo em localStorage).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = setTimeout(() => {
      const entryCount = Object.values(entries).filter(
        (e) => (e?.raw ?? "").trim() !== "",
      ).length;
      if (entryCount === 0 && notes.trim() === "") {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* noop */
        }
        return;
      }
      try {
        const payload: DraftPayload = {
          entries,
          notes,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      } catch {
        // quota cheia / private mode — ignora silenciosamente. Lojista
        // perde a feature de auto-save mas o form continua funcionando.
      }
    }, DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    };
  }, [entries, notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => {
      const haystack = [
        r.productName,
        r.variantName ?? "",
        r.categoryName ?? "",
        r.internalCode ?? "",
        r.gtin ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  // Resumo: só linhas digitadas entram.
  const summary = useMemo(() => {
    let filledCount = 0;
    let withDiffCount = 0;
    let totalPositiveDelta = 0;
    let totalNegativeDelta = 0;
    for (const r of items) {
      const k = rowKey(r);
      const raw = entries[k]?.raw ?? "";
      const counted = parseCountInput(raw);
      if (counted === null) continue;
      filledCount += 1;
      const delta = counted - r.stockQuantity;
      if (delta === 0) continue;
      withDiffCount += 1;
      if (delta > 0) totalPositiveDelta += delta;
      else totalNegativeDelta += delta;
    }
    return {
      filledCount,
      withDiffCount,
      totalPositiveDelta,
      totalNegativeDelta,
    };
  }, [items, entries]);

  const setEntry = (key: string, raw: string) => {
    setEntries((prev) => ({ ...prev, [key]: { raw } }));
  };

  const focusNext = (currentKey: string) => {
    const visibleKeys = filtered.map(rowKey);
    const idx = visibleKeys.indexOf(currentKey);
    if (idx === -1 || idx === visibleKeys.length - 1) return;
    const nextRef = inputRefs.current[visibleKeys[idx + 1]!];
    nextRef?.focus();
    nextRef?.select();
  };

  const handleSubmit = async () => {
    const payloadItems = items
      .map((r) => {
        const k = rowKey(r);
        const counted = parseCountInput(entries[k]?.raw ?? "");
        if (counted === null) return null;
        return {
          productId: r.productId,
          variantId: r.variantId,
          countedQuantity: counted,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (payloadItems.length === 0) {
      toast.error("Digite a quantidade contada de pelo menos um produto.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await recordPhysicalInventory({
        items: payloadItems,
        notes: notes.trim() || null,
      });
      if (result.ok) {
        toast.success(
          result.adjustmentsCount > 0
            ? `${result.adjustmentsCount} ${result.adjustmentsCount === 1 ? "ajuste registrado" : "ajustes registrados"}. ${
                result.skippedNoChange > 0
                  ? `${result.skippedNoChange} sem diferença.`
                  : ""
              }`.trim()
            : "Contagem registrada. Nenhuma diferença encontrada.",
        );
        setEntries({});
        setNotes("");
        setConfirmOpen(false);
        // Bloco G UX (2026-05-29) — limpa rascunho após registrar com sucesso.
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(DRAFT_KEY);
          } catch {
            /* noop */
          }
        }
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header sticky com busca + resumo + CTAs */}
      <div className="bg-bg-app sticky top-0 z-10 -mx-1 rounded-xl border border-line px-3 py-3 backdrop-blur sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <SearchIcon
              size={14}
              className="text-ink-4 absolute top-1/2 left-3 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto, variante, código…"
              className="h-9 pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <SummaryPill
              label="contados"
              value={summary.filledCount}
              tone="neutral"
            />
            <SummaryPill
              label="com diferença"
              value={summary.withDiffCount}
              tone={summary.withDiffCount > 0 ? "warning" : "neutral"}
            />
            {summary.totalPositiveDelta > 0 ? (
              <SummaryPill
                label="a somar"
                value={`+${summary.totalPositiveDelta}`}
                tone="positive"
              />
            ) : null}
            {summary.totalNegativeDelta < 0 ? (
              <SummaryPill
                label="a subtrair"
                value={`${summary.totalNegativeDelta}`}
                tone="negative"
              />
            ) : null}

            <Button
              type="button"
              size="sm"
              disabled={submitting || summary.filledCount === 0}
              onClick={() => setConfirmOpen(true)}
              className="h-9"
            >
              {submitting ? (
                <>
                  <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                  Registrando…
                </>
              ) : (
                <>Registrar ajustes</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela densa */}
      <div className="b3-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-app text-ink-4 sticky top-0 text-left text-[11px] tracking-wide uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 text-right font-medium">Sistema</th>
                <th className="px-3 py-2 text-right font-medium">Contado</th>
                <th className="px-3 py-2 text-right font-medium">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-ink-4 px-3 py-8 text-center text-sm">
                    Nenhum produto encontrado pra essa busca.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const k = rowKey(r);
                  const raw = entries[k]?.raw ?? "";
                  const counted = parseCountInput(raw);
                  const delta = counted === null ? null : counted - r.stockQuantity;
                  const hasInvalidInput = raw.trim() !== "" && counted === null;

                  return (
                    <tr
                      key={k}
                      className="border-line hover:bg-bg-app/40 border-t"
                    >
                      <td className="px-3 py-2">
                        <div className="text-ink-1 font-medium">
                          {r.productName}
                        </div>
                        {r.variantName ? (
                          <div className="text-ink-4 text-xs">
                            {r.variantName}
                          </div>
                        ) : null}
                        {r.internalCode || r.gtin ? (
                          <div className="text-ink-4 mt-0.5 flex gap-2 text-[11px]">
                            {r.internalCode ? <span>cód: {r.internalCode}</span> : null}
                            {r.gtin ? <span>EAN: {r.gtin}</span> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-ink-3 px-3 py-2 text-xs">
                        {r.categoryName ?? "—"}
                      </td>
                      <td className="text-ink-2 px-3 py-2 text-right tabular-nums">
                        {r.stockQuantity}{" "}
                        <span className="text-ink-4 text-[10px]">{r.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          ref={(el) => {
                            inputRefs.current[k] = el;
                          }}
                          value={raw}
                          onChange={(e) => setEntry(k, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              focusNext(k);
                            }
                          }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="—"
                          className={`ml-auto h-8 w-24 text-right text-sm tabular-nums ${
                            hasInvalidInput
                              ? "border-state-error focus-visible:ring-state-error"
                              : ""
                          }`}
                          aria-invalid={hasInvalidInput}
                          aria-label={`Contado de ${r.productName}${
                            r.variantName ? " " + r.variantName : ""
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        <DeltaBadge delta={delta} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observação livre */}
      <div className="space-y-1">
        <label
          htmlFor="phys-notes"
          className="text-ink-2 text-xs font-medium"
        >
          Observação (opcional)
        </label>
        <Input
          id="phys-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='Ex: "Inventário de outubro" ou "Contagem após mudança de loja"'
          maxLength={500}
        />
        <p className="text-ink-4 text-[11px]">
          Texto comum a todos os ajustes deste batch — aparece no histórico
          de movimentação.
        </p>
      </div>

      {/* Confirm dialog */}
      {confirmOpen ? (
        <ConfirmDialog
          summary={summary}
          notes={notes}
          submitting={submitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleSubmit}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// helpers visuais
// ---------------------------------------------------------------------

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "neutral" | "positive" | "negative" | "warning";
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "bg-bg-app text-ink-3 border-line",
    positive: "bg-state-success-wash text-state-success border-state-success/30",
    negative: "bg-state-error-wash text-state-error border-state-error/30",
    warning: "bg-state-warning-wash text-state-warning border-state-warning/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium tabular-nums ${toneClasses[tone]}`}
    >
      <span>{value}</span>
      <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-ink-4">—</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-ink-4 inline-flex items-center gap-0.5">
        <MinusIcon size={12} /> 0
      </span>
    );
  }
  if (delta > 0) {
    return (
      <span className="text-state-success inline-flex items-center gap-0.5 font-medium">
        <ArrowUpIcon size={12} />+{delta}
      </span>
    );
  }
  return (
    <span className="text-state-error inline-flex items-center gap-0.5 font-medium">
      <ArrowDownIcon size={12} />
      {delta}
    </span>
  );
}

function ConfirmDialog({
  summary,
  notes,
  submitting,
  onCancel,
  onConfirm,
}: {
  summary: {
    filledCount: number;
    withDiffCount: number;
    totalPositiveDelta: number;
    totalNegativeDelta: number;
  };
  notes: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="phys-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="bg-surface border-line w-full max-w-md rounded-xl border p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="bg-brand-wash text-brand mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <CheckIcon size={18} />
          </div>
          <div className="flex-1">
            <h3
              id="phys-confirm-title"
              className="text-ink-1 text-base font-semibold"
            >
              Confirmar contagem física
            </h3>
            <p className="text-ink-4 mt-1 text-sm">
              Você está registrando{" "}
              <strong className="text-ink-1">{summary.filledCount}</strong>{" "}
              {summary.filledCount === 1 ? "produto contado" : "produtos contados"}.
              {summary.withDiffCount > 0 ? (
                <>
                  {" "}
                  <strong className="text-ink-1">{summary.withDiffCount}</strong>{" "}
                  {summary.withDiffCount === 1 ? "tem" : "têm"} diferença com o
                  sistema.
                </>
              ) : (
                <> Nenhuma diferença encontrada — nenhum ajuste será criado.</>
              )}
            </p>
          </div>
        </div>

        {summary.withDiffCount > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {summary.totalPositiveDelta > 0 ? (
              <div className="bg-state-success-wash text-state-success rounded-md px-3 py-2 text-sm tabular-nums">
                <span className="font-semibold">+{summary.totalPositiveDelta}</span>{" "}
                <span className="opacity-70">a somar</span>
              </div>
            ) : null}
            {summary.totalNegativeDelta < 0 ? (
              <div className="bg-state-error-wash text-state-error rounded-md px-3 py-2 text-sm tabular-nums">
                <span className="font-semibold">{summary.totalNegativeDelta}</span>{" "}
                <span className="opacity-70">a subtrair</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {notes.trim() ? (
          <div className="text-ink-3 mt-3 rounded-md bg-bg-app px-3 py-2 text-xs">
            <span className="text-ink-4">Observação: </span>
            {notes.trim()}
          </div>
        ) : null}

        <div className="text-ink-4 mt-4 rounded-md bg-bg-app px-3 py-2 text-[11px]">
          Cada produto com diferença vira uma linha em{" "}
          <code className="text-ink-2">/admin/estoque</code> com type
          <code className="text-ink-2">adjustment</code>. Sistema é
          append-only — pra corrigir, lance ajuste reverso.
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            <XCircleIcon size={14} className="mr-1" />
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                Registrando…
              </>
            ) : (
              <>Confirmar e registrar</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
