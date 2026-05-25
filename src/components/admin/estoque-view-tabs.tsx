"use client";

/**
 * Tabs primárias do /admin/estoque — Onda 1.4 (2026-05-24).
 *
 * Alterna entre "Saldo por produto" (snapshot, default) e "Histórico"
 * (feed event-sourced de movimentações). URL-driven via `?view=saldo|historico`.
 *
 * Trocar de view limpa filtros específicos do view anterior (`type` do
 * feed quando vai pra saldo; `status` do snapshot quando vai pra feed)
 * pra evitar param-stuck que faria a próxima view abrir filtrada sem
 * o lojista entender por quê.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TABS = [
  { value: "saldo", label: "Saldo por produto" },
  { value: "historico", label: "Histórico" },
] as const;

type ViewKey = (typeof TABS)[number]["value"];

export function EstoqueViewTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current: ViewKey =
    searchParams.get("view") === "historico" ? "historico" : "saldo";

  const handleSelect = (next: ViewKey) => {
    if (next === current) return;
    const usp = new URLSearchParams(window.location.search);
    usp.delete("page");
    if (next === "saldo") {
      usp.delete("view");
      usp.delete("type"); // param do feed; some na view saldo
    } else {
      usp.set("view", "historico");
      usp.delete("status"); // param do snapshot; some na view feed
    }
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div role="tablist" aria-label="Visão do estoque" className="b3-tabs">
      {TABS.map((tab) => {
        const isActive = tab.value === current;
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
          </button>
        );
      })}
    </div>
  );
}
