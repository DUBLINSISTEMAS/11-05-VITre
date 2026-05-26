"use client";

/**
 * ADR-0034 Camada 2 Onda C — grid bulk-edit de custo/comissão/margem.
 *
 * UX:
 *   - Tabela densa: foto thumb · nome (read-only) · preço de venda
 *     (read-only) · custo (input) · comissão % (input) · margem
 *     (calculada read-only) · status (badge).
 *   - Auto-save debounced 1.2s após sair do foco. Botão "Salvar tudo"
 *     no topo força sync imediato.
 *   - Tab pula pra próxima célula da MESMA coluna na linha seguinte
 *     (não pra próxima coluna). Comportamento de planilha.
 *   - Indicador por linha: "sem custo" amarelo / "alterado, pendente"
 *     dourado / "salvo" verde.
 *
 * Action: `updateProductCostBatch` (até 100 linhas por chamada). Linhas
 * com diff zero (lojista digitou e voltou ao valor original) são
 * excluídas do batch.
 */

import {
  CheckCircle2Icon,
  Loader2Icon,
  SaveIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ProductCostBatchRow } from "@/actions/product/schema";
import { updateProductCostBatch } from "@/actions/product/update-cost-batch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import { formatBRL as formatBRLPricing } from "@/lib/pricing";

interface CostGridRow {
  id: string;
  name: string;
  basePriceInCents: number;
  costPriceInCents: number | null;
  defaultCommissionBps: number | null;
  brand: string | null;
  internalCode: string | null;
}

interface CostGridClientProps {
  initialRows: CostGridRow[];
}

type RowStatus = "no-cost" | "pristine" | "dirty" | "saving" | "saved" | "error";

interface RowState {
  costPriceInCents: number | null;
  defaultCommissionBps: number | null;
  /** Estado original do server — referência pra detectar diff. */
  originalCost: number | null;
  originalCommission: number | null;
  status: RowStatus;
  /** Timestamp da última edição — usado pra debounce. */
  lastEditAt: number;
}

const AUTOSAVE_DEBOUNCE_MS = 1200;

function formatBRL(cents: number | null): string {
  if (cents === null) return "—";
  return formatBRLPricing(cents);
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function parseCurrencyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Aceita "12,34" ou "12.34". Remove R$, espaços.
  const cleaned = trimmed.replace(/[R$\s]/g, "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function parsePercentInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace("%", "").replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return Math.round(num * 100); // bps
}

function calcMarginPct(
  cost: number | null,
  price: number,
): number | null {
  if (cost === null || price === 0) return null;
  return ((price - cost) / price) * 100;
}

export function CostGridClient({ initialRows }: CostGridClientProps) {
  const [states, setStates] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const r of initialRows) {
      init[r.id] = {
        costPriceInCents: r.costPriceInCents,
        defaultCommissionBps: r.defaultCommissionBps,
        originalCost: r.costPriceInCents,
        originalCommission: r.defaultCommissionBps,
        status: r.costPriceInCents === null ? "no-cost" : "pristine",
        lastEditAt: 0,
      };
    }
    return init;
  });
  const [isSavingAll, setIsSavingAll] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  // Limpa timers ao desmontar
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  const dirtyRows = useMemo(
    () =>
      Object.entries(states).filter(
        ([, s]) =>
          s.costPriceInCents !== s.originalCost ||
          s.defaultCommissionBps !== s.originalCommission,
      ),
    [states],
  );

  const persistRow = useCallback(
    async (productId: string) => {
      const state = states[productId];
      if (!state) return;
      // Verifica se ainda há diff (pode ter voltado ao original)
      const diffCost = state.costPriceInCents !== state.originalCost;
      const diffCommission =
        state.defaultCommissionBps !== state.originalCommission;
      if (!diffCost && !diffCommission) return;

      setStates((prev) => ({
        ...prev,
        [productId]: { ...prev[productId]!, status: "saving" },
      }));

      const row: ProductCostBatchRow = { productId };
      if (diffCost) row.costPriceInCents = state.costPriceInCents;
      if (diffCommission) row.defaultCommissionBps = state.defaultCommissionBps;

      let result: Awaited<ReturnType<typeof updateProductCostBatch>>;
      try {
        result = await updateProductCostBatch({ rows: [row] });
      } catch (err) {
        logger.error("admin.product_cost.autosave_failed", { err, productId });
        setStates((prev) => {
          const cur = prev[productId];
          if (!cur) return prev;
          return {
            ...prev,
            [productId]: { ...cur, status: "error" },
          };
        });
        toast.error("Erro ao salvar custo. Tente novamente.");
        return;
      }

      setStates((prev) => {
        const cur = prev[productId];
        if (!cur) return prev;
        if (!result.ok) {
          return {
            ...prev,
            [productId]: { ...cur, status: "error" },
          };
        }
        return {
          ...prev,
          [productId]: {
            ...cur,
            originalCost: cur.costPriceInCents,
            originalCommission: cur.defaultCommissionBps,
            status: cur.costPriceInCents === null ? "no-cost" : "saved",
          },
        };
      });

      if (!result.ok) {
        toast.error(`Erro ao salvar: ${result.error}`);
      }
    },
    [states],
  );

  const scheduleAutoSave = useCallback(
    (productId: string) => {
      if (debounceTimers.current[productId]) {
        clearTimeout(debounceTimers.current[productId]);
      }
      debounceTimers.current[productId] = setTimeout(() => {
        void persistRow(productId);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [persistRow],
  );

  const handleCostChange = (productId: string, raw: string) => {
    const cents = parseCurrencyInput(raw);
    setStates((prev) => {
      const cur = prev[productId];
      if (!cur) return prev;
      return {
        ...prev,
        [productId]: {
          ...cur,
          costPriceInCents: cents,
          status: "dirty",
          lastEditAt: Date.now(),
        },
      };
    });
    scheduleAutoSave(productId);
  };

  const handleCommissionChange = (productId: string, raw: string) => {
    const bps = parsePercentInput(raw);
    setStates((prev) => {
      const cur = prev[productId];
      if (!cur) return prev;
      return {
        ...prev,
        [productId]: {
          ...cur,
          defaultCommissionBps: bps,
          status: "dirty",
          lastEditAt: Date.now(),
        },
      };
    });
    scheduleAutoSave(productId);
  };

  const handleSaveAll = useCallback(async () => {
    if (dirtyRows.length === 0) {
      toast.info("Nada novo pra salvar.");
      return;
    }
    setIsSavingAll(true);
    // Cancela timers pendentes — vamos persistir tudo agora.
    for (const t of Object.values(debounceTimers.current)) clearTimeout(t);

    // Batches de até 100 linhas (limite da action)
    const batch: ProductCostBatchRow[] = dirtyRows.map(([productId, s]) => ({
      productId,
      costPriceInCents: s.costPriceInCents,
      defaultCommissionBps: s.defaultCommissionBps,
    }));

    const chunks: ProductCostBatchRow[][] = [];
    for (let i = 0; i < batch.length; i += 100) {
      chunks.push(batch.slice(i, i + 100));
    }

    let totalUpdated = 0;
    let firstError: string | null = null;

    try {
      for (const chunk of chunks) {
        const result = await updateProductCostBatch({ rows: chunk });
        if (result.ok) {
          totalUpdated += result.updatedCount;
        } else if (firstError === null) {
          firstError = result.error;
        }
      }
    } catch (err) {
      logger.error("admin.product_cost.save_all_failed", { err });
      firstError = "Erro ao salvar. Tente novamente.";
    }

    setStates((prev) => {
      const next = { ...prev };
      for (const [productId] of dirtyRows) {
        const cur = next[productId];
        if (!cur) continue;
        if (firstError) {
          next[productId] = { ...cur, status: "error" };
        } else {
          next[productId] = {
            ...cur,
            originalCost: cur.costPriceInCents,
            originalCommission: cur.defaultCommissionBps,
            status: cur.costPriceInCents === null ? "no-cost" : "saved",
          };
        }
      }
      return next;
    });

    setIsSavingAll(false);

    if (firstError) {
      toast.error(`Erro: ${firstError}`);
    } else {
      toast.success(`${totalUpdated} produto(s) atualizado(s).`);
    }
  }, [dirtyRows]);

  return (
    <div className="b3-card flex flex-col gap-3 rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] text-ink-3">
          {dirtyRows.length > 0 ? (
            <span className="font-medium text-amber-700 dark:text-amber-300">
              {dirtyRows.length} alteração(ões) pendente(s)
            </span>
          ) : (
            <span className="text-ink-4">Tudo salvo.</span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleSaveAll}
          disabled={isSavingAll || dirtyRows.length === 0}
        >
          {isSavingAll ? (
            <>
              <Loader2Icon className="animate-spin size-3.5" /> Salvando…
            </>
          ) : (
            <>
              <SaveIcon className="size-3.5" /> Salvar tudo
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-4">
              <th className="py-2 pr-3 font-medium">Produto</th>
              <th className="py-2 px-2 font-medium text-right">Venda</th>
              <th className="py-2 px-2 font-medium text-right">Custo</th>
              <th className="py-2 px-2 font-medium text-right">Comissão %</th>
              <th className="py-2 px-2 font-medium text-right">Margem</th>
              <th className="py-2 pl-2 font-medium text-center w-12">•</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row) => {
              const state = states[row.id];
              if (!state) return null;
              const margin = calcMarginPct(
                state.costPriceInCents,
                row.basePriceInCents,
              );
              const marginStr =
                margin === null
                  ? "—"
                  : formatPercent(margin);
              const marginTone =
                margin === null
                  ? "text-ink-4"
                  : margin < 0
                    ? "text-destructive"
                    : margin < 20
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300";

              const StatusIcon =
                state.status === "saving"
                  ? Loader2Icon
                  : state.status === "saved"
                    ? CheckCircle2Icon
                    : state.status === "error"
                      ? TriangleAlertIcon
                      : state.status === "no-cost"
                        ? TriangleAlertIcon
                        : state.status === "dirty"
                          ? SaveIcon
                          : null;
              const statusTone =
                state.status === "saving"
                  ? "text-ink-3 animate-spin"
                  : state.status === "saved"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : state.status === "error"
                      ? "text-destructive"
                      : state.status === "no-cost"
                        ? "text-amber-600 dark:text-amber-400"
                        : state.status === "dirty"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-ink-5";
              const statusLabel =
                state.status === "saving"
                  ? "Salvando"
                  : state.status === "saved"
                    ? "Salvo"
                    : state.status === "error"
                      ? "Erro ao salvar"
                      : state.status === "no-cost"
                        ? "Sem custo"
                        : state.status === "dirty"
                          ? "Alterado, pendente"
                          : "Sem alterações";

              return (
                <tr
                  key={row.id}
                  className="border-b border-line/60 transition-colors hover:bg-bg-app/60"
                >
                  <td className="py-1.5 pr-3 align-middle">
                    <div className="flex flex-col">
                      <span className="text-ink-1 font-medium leading-tight">
                        {row.name}
                      </span>
                      <span className="text-ink-4 text-[10.5px] leading-tight">
                        {[row.brand, row.internalCode]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-right align-middle text-ink-2">
                    {formatBRL(row.basePriceInCents)}
                  </td>
                  <td className="py-1.5 px-2 text-right align-middle">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      className="h-8 text-right tabular-nums"
                      defaultValue={
                        state.originalCost === null
                          ? ""
                          : (state.originalCost / 100).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                      }
                      onChange={(e) => handleCostChange(row.id, e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right align-middle">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      className="h-8 text-right tabular-nums"
                      defaultValue={
                        state.originalCommission === null
                          ? ""
                          : (state.originalCommission / 100).toString()
                      }
                      onChange={(e) =>
                        handleCommissionChange(row.id, e.target.value)
                      }
                    />
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right align-middle font-medium ${marginTone}`}
                  >
                    {marginStr}
                  </td>
                  <td className="py-1.5 pl-2 align-middle">
                    <div
                      className={`flex items-center justify-center gap-1 ${statusTone}`}
                      title={statusLabel}
                      aria-label={statusLabel}
                    >
                      {StatusIcon ? (
                        <StatusIcon className="size-3.5" aria-hidden />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current/30" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-ink-4 text-[11px] leading-tight">
        Dica: Tab pula pra próxima célula. Salva automaticamente 1,2s após
        sair do foco. Use o botão &ldquo;Salvar tudo&rdquo; pra forçar sync
        imediato.
      </p>
    </div>
  );
}
