"use client";

// Tabs de status pra lista de pedidos — port Dublin v3 (ADR-0019, Onda A.6).
// Substitui o `<Select>` de status do filtro antigo. Counts vêm do server
// via props (1 query agregada via FILTER em pedidos/page.tsx). Clica em
// uma tab → router.replace com ?status=X (ou remove se "all"). Reset de
// page=1 ao trocar tab.
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface OrdersStatusCounts {
  total: number;
  awaiting_whatsapp: number;
  confirmed: number;
  fulfilled: number;
  canceled: number;
}

interface OrdersStatusTabsProps {
  counts: OrdersStatusCounts;
}

const TABS: ReadonlyArray<{
  value: string | null;
  label: string;
  countKey: keyof OrdersStatusCounts;
}> = [
  { value: null, label: "Todos", countKey: "total" },
  { value: "awaiting_whatsapp", label: "Aguardando", countKey: "awaiting_whatsapp" },
  { value: "confirmed", label: "Confirmados", countKey: "confirmed" },
  { value: "fulfilled", label: "Cumpridos", countKey: "fulfilled" },
  { value: "canceled", label: "Cancelados", countKey: "canceled" },
];

export function OrdersStatusTabs({ counts }: OrdersStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const active = searchParams.get("status");

  const updateStatus = (next: string | null) => {
    const usp = new URLSearchParams(window.location.search);
    if (next === null) usp.delete("status");
    else usp.set("status", next);
    usp.delete("page");
    const qs = usp.toString();
    startTransition(() => {
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    });
  };

  return (
    <div className="b3-tabs" role="tablist" aria-label="Filtrar pedidos por status">
      {TABS.map((tab) => {
        const isActive =
          (tab.value === null && active === null) || tab.value === active;
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? "true" : undefined}
            className="b3-tab"
            onClick={() => updateStatus(tab.value)}
          >
            {tab.label} · {counts[tab.countKey]}
          </button>
        );
      })}
    </div>
  );
}
