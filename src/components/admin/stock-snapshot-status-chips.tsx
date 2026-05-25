"use client";

/**
 * Chips de filtro de status pra tabela de saldo por produto — Onda 1.4.
 *
 * URL-driven via `?status=with-stock|zero|low|no-tracking`. Default = todos.
 * 5 opções (Todos / Com estoque / Zerados / Repor / Sem controle) com count
 * cada — lojista decide a partir do número da onde ele quer ir primeiro.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const CHIPS = [
  { value: null, label: "Todos", key: "all" },
  { value: "with-stock", label: "Com saldo", key: "withStock" },
  { value: "zero", label: "Zerados", key: "zero" },
  { value: "low", label: "Para repor", key: "low" },
  { value: "no-tracking", label: "Sem controle", key: "noTracking" },
] as const;

export interface StockSnapshotStatusChipsCounts {
  all: number;
  withStock: number;
  zero: number;
  low: number;
  noTracking: number;
}

interface Props {
  counts: StockSnapshotStatusChipsCounts;
}

export function StockSnapshotStatusChips({ counts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("status");

  const handleSelect = (next: string | null) => {
    if (next === current) return;
    const usp = new URLSearchParams(window.location.search);
    usp.delete("page");
    if (next === null) {
      usp.delete("status");
    } else {
      usp.set("status", next);
    }
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div role="tablist" className="b3-tabs">
      {CHIPS.map((chip) => {
        const isActive =
          chip.value === null ? !current : current === chip.value;
        const count = counts[chip.key];
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(chip.value)}
            className="b3-tab"
            data-active={isActive ? "true" : undefined}
          >
            {chip.label} · {count}
          </button>
        );
      })}
    </div>
  );
}
