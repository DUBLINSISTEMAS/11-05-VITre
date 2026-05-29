"use client";

/**
 * Tabs primárias do /admin/estoque — Onda 1.4 + PP9 + Onda L4 (2026-05-29).
 *
 * 5 views URL-driven via `?view=saldo|historico|alertas|parado|vencendo`:
 *   - saldo (default) — snapshot por produto
 *   - historico       — feed event-sourced de movimentações
 *   - alertas (PP9)   — produtos zerados ou abaixo do mínimo
 *   - parado (L4)     — capital empatado (60+ dias sem vender)
 *   - vencendo (L4)   — lotes vencendo em 60 dias (FEFO)
 *
 * "parado" e "vencendo" eram rotas separadas (`/admin/estoque/parado`,
 * `/admin/estoque/vencendo`) — viraram tabs internas em Onda L4 pra
 * eliminar a fragmentacao do menu. Rotas antigas seguem como redirects.
 *
 * Trocar de view limpa filtros do view anterior (param-stuck que faria
 * a proxima view abrir filtrada sem o lojista entender por que).
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TABS = [
  { value: "saldo", label: "Saldo" },
  { value: "historico", label: "Movimentações" },
  { value: "alertas", label: "Alertas" },
  { value: "parado", label: "Parado" },
  { value: "vencendo", label: "Vencendo" },
] as const;

type ViewKey = (typeof TABS)[number]["value"];

interface EstoqueViewTabsProps {
  /** PP9 — contador de alertas (zerados + abaixo do mínimo) renderizado
      como pill numérico ao lado do label da tab. */
  alertCount?: number;
  /** Onda L4 — contador de produtos parados ha 60d+. */
  parkedCount?: number;
  /** Onda L4 — contador de lotes vencendo em ate 60d (inclui vencidos). */
  expiringCount?: number;
}

export function EstoqueViewTabs({
  alertCount = 0,
  parkedCount = 0,
  expiringCount = 0,
}: EstoqueViewTabsProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const viewParam = searchParams.get("view");
  const current: ViewKey =
    viewParam === "historico"
      ? "historico"
      : viewParam === "alertas"
        ? "alertas"
        : viewParam === "parado"
          ? "parado"
          : viewParam === "vencendo"
            ? "vencendo"
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
      usp.delete("status");
    } else if (next === "parado" || next === "vencendo") {
      usp.set("view", next);
      // Filtros de outras views nao se aplicam — limpa pra UI honesta.
      usp.delete("type");
      usp.delete("status");
      usp.delete("q");
      usp.delete("categoryId");
      usp.delete("sort");
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
        const count =
          tab.value === "alertas"
            ? alertCount
            : tab.value === "parado"
              ? parkedCount
              : tab.value === "vencendo"
                ? expiringCount
                : 0;
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
            {count > 0 ? (
              <span className="count" aria-label={`${count} itens`}>
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
