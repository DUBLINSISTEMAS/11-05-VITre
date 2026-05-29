"use client";

/**
 * InlineCostCell — Onda M3 (2026-05-29).
 *
 * Célula editável de CUSTO na ProductsTable quando filtro "Sem custo"
 * está ativo. Lojista digita direto na linha, debounce 1.5s ou blur
 * grava via `updateProductCostInline`.
 *
 * Recupera o fluxo "preencher 30 produtos sem custo em 10min" que foi
 * perdido com a deleção da tela /admin/produtos/custos (L1). Sem abrir
 * drawer, sem 6 round-trips por produto — só UPDATE direto.
 *
 * Estado visual:
 *   idle    — input vazio ou com valor original, sem indicador
 *   dirty   — texto alterado, ainda nao salvou (icone laranja)
 *   saving  — em transito (spinner)
 *   saved   — salvou ok (check verde, volta pra idle apos 1.5s)
 *   error   — falhou (icone vermelho + tooltip do erro)
 *
 * Acessibilidade: Enter pula pro proximo input da próxima linha (foco
 * automatico). Esc cancela edição. Aria-label explica funcao.
 */

import {
  CheckIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updateProductCostInline } from "@/actions/product/update-cost-inline";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const SAVED_FLASH_MS = 1500;

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface InlineCostCellProps {
  productId: string;
  productName: string;
  initialCostInCents: number | null;
  /** Callback opcional pra atualizar coluna SOBRA em tempo real (cor). */
  onCostChange?: (nextInCents: number | null) => void;
}

/**
 * Parser BR — aceita "12", "12,50", "12.50", "R$ 12,50". Retorna centavos
 * arredondados ou null se vazio. Retorna undefined se invalido (mantem ultimo).
 */
function parseInputToCents(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/[R$\s]/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove . de milhar
    .replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 9_999_999.99) return undefined;
  return Math.round(num * 100);
}

function centsToInputText(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function InlineCostCell({
  productId,
  productName,
  initialCostInCents,
  onCostChange,
}: InlineCostCellProps) {
  const [text, setText] = useState(() => centsToInputText(initialCostInCents));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedCents, setLastSavedCents] = useState<number | null>(
    initialCostInCents,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Limpa timers no unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  const persist = useCallback(
    async (cents: number | null) => {
      if (cents === lastSavedCents) {
        setStatus("idle");
        return;
      }
      setStatus("saving");
      const result = await updateProductCostInline({
        productId,
        costPriceInCents: cents,
      });
      if (!result.ok) {
        setStatus("error");
        toast.error(`"${productName}": ${result.error}`);
        return;
      }
      setLastSavedCents(cents);
      setStatus("saved");
      onCostChange?.(cents);
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_FLASH_MS);
    },
    [productId, productName, lastSavedCents, onCostChange],
  );

  const scheduleSave = useCallback(
    (cents: number | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persist(cents);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  const handleChange = (raw: string) => {
    setText(raw);
    const cents = parseInputToCents(raw);
    if (cents === undefined) {
      // valor invalido — feedback visual mas nao salva
      setStatus("dirty");
      return;
    }
    if (cents === lastSavedCents) {
      setStatus("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    setStatus("dirty");
    scheduleSave(cents);
  };

  const handleBlur = () => {
    if (status !== "dirty") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const cents = parseInputToCents(text);
    if (cents === undefined) return;
    void persist(cents);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const cents = parseInputToCents(text);
      if (cents !== undefined) void persist(cents);
      // Foca proximo input com data-inline-cost no DOM
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[data-inline-cost]"),
      );
      const idx = inputs.indexOf(inputRef.current!);
      const next = inputs[idx + 1];
      if (next) next.focus();
      else inputRef.current?.blur();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setText(centsToInputText(lastSavedCents));
      setStatus("idle");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inputRef.current?.blur();
    }
  };

  return (
    <span
      className="inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        data-inline-cost
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="0,00"
        aria-label={`Custo de ${productName}`}
        className="w-24 rounded border border-line bg-surface px-2 py-1 text-right font-mono text-[12.5px] tabular-nums outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <StatusIndicator status={status} />
    </span>
  );
}

function StatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return (
      <Loader2Icon
        className="text-ink-4 size-3.5 animate-spin"
        aria-label="Salvando"
      />
    );
  if (status === "saved")
    return (
      <CheckIcon
        className="size-3.5 text-emerald-600"
        aria-label="Salvo"
      />
    );
  if (status === "error")
    return (
      <TriangleAlertIcon
        className="text-destructive size-3.5"
        aria-label="Erro ao salvar"
      />
    );
  if (status === "dirty")
    return (
      <span
        className="size-2 rounded-full bg-amber-500"
        aria-label="Alteração não salva"
      />
    );
  return <span className="inline-block size-3.5" aria-hidden />;
}
