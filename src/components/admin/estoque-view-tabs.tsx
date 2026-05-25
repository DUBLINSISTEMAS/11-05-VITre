"use client";

/**
 * Tabs primárias do /admin/estoque — Onda 1.4 (2026-05-24), PP9 redesign
 * (handoff 2026-05-25) adiciona 3ª tab "Alertas".
 *
 * 3 views URL-driven via `?view=saldo|historico|alertas`:
 *   - saldo (default)    — snapshot por produto
 *   - historico          — feed event-sourced de movimentações
 *   - alertas (PP9)      — atalho pra produtos zerados ou abaixo do mínimo
 *                          (mesmo dataset do snapshot com status=low|zero
 *                          forçado, helpbar de "criar pedido de compra")
 *
 * Trocar de view limpa filtros específicos do view anterior pra evitar
 * param-stuck que faria a próxima view abrir filtrada sem o lojista
 * entender por quê.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TABS = [
  { value: "saldo", label: "Saldo" },
  { value: "historico", label: "Movimentações" },
  { value: "alertas", label: "Alertas" },
] as const;

type ViewKey = (typeof TABS)[number]["value"];

interface EstoqueViewTabsProps {
  /** PP9 — contador de alertas (zerados + abaixo do mínimo) renderizado
      como pill numérico ao lado do label da tab. */
  alertCount?: number;
}

export function EstoqueViewTabs({ alertCount = 0 }: EstoqueViewTabsProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const viewParam = searchParams.get("view");
  const current: ViewKey =
    viewParam === "historico"
      ? "historico"
      : viewParam === "alertas"
        ? "alertas"
        : "saldo";

  const handleSelect = (next: ViewKey) => {
    if (next === current) return;
    const usp = new URLSearchParams(window.location.search);
    usp.delete("page");
    if (next === "saldo") {
      usp.delete("view");
      usp.delete("type");
    } else if (next === "alertas") {
      usp.set("view", "alertas");
      usp.delete("type");
      // status é forçado pela page quando view=alertas (não passa pela URL)
      usp.delete("status");
    } else {
      usp.set("view", "historico");
      usp.delete("status");
    }
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div role="tablist" aria-label="Visão do estoque" className="b3-tabs">
      {TABS.map((tab) => {
        const isActive = tab.value === current;
        const showCount = tab.value === "alertas" && alertCount > 0;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(tab.value)}
            className="b3-tab"
            data-active={isActive ? "true" : undefined}
          >
            {tab.label}
            {showCount ? (
              <span
                className="count"
                aria-label={`${alertCount} ${alertCount === 1 ? "alerta" : "alertas"}`}
              >
                {alertCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
