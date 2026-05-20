"use client";

// Tabs de status da lista de produtos — port Dublin v3 (ADR-0019, Onda A.7).
//
// 6 tabs URL-driven. "Em promoção" usa `?promo=1` (mutex com `?status`):
// selecionar uma tab `status` REMOVE `?promo`; selecionar "Em promoção"
// REMOVE `?status`. Convenção CLAUDE.md #11 (URL como state).
//
// Layout `b3-tabs` (overflow-x:auto, padding 20px lateral via container).
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TABS = [
  { kind: "all", label: "Todos", countKey: "all" },
  { kind: "status", value: "active", label: "Publicados", countKey: "active" },
  { kind: "promo", label: "Em promoção", countKey: "promo" },
  { kind: "status", value: "draft", label: "Rascunhos", countKey: "draft" },
  { kind: "status", value: "inactive", label: "Despublicados", countKey: "inactive" },
  { kind: "status", value: "no-stock", label: "Sem estoque", countKey: "no-stock" },
] as const;

type ProductStatusFilter =
  | "active"
  | "inactive"
  | "draft"
  | "no-stock";

export interface ProductsStatusTabsCounts {
  all: number;
  active: number;
  inactive: number;
  draft: number;
  "no-stock": number;
  promo: number;
}

interface ProductsStatusTabsProps {
  counts: ProductsStatusTabsCounts;
}

export function ProductsStatusTabs({ counts }: ProductsStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus = searchParams.get("status");
  const currentPromo = searchParams.get("promo") === "1";

  const handleSelect = (tab: (typeof TABS)[number]) => {
    const usp = new URLSearchParams(window.location.search);
    usp.delete("page");
    if (tab.kind === "all") {
      usp.delete("status");
      usp.delete("promo");
    } else if (tab.kind === "promo") {
      usp.delete("status");
      usp.set("promo", "1");
    } else {
      usp.delete("promo");
      usp.set("status", tab.value);
    }
    startTransition(() => {
      router.replace(`?${usp.toString()}`, { scroll: false });
    });
  };

  return (
    <div role="tablist" aria-label="Filtrar por status" className="b3-tabs">
      {TABS.map((tab) => {
        const isActive =
          tab.kind === "all"
            ? !currentStatus && !currentPromo
            : tab.kind === "promo"
              ? currentPromo
              : !currentPromo && currentStatus === tab.value;
        const count = counts[tab.countKey];
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(tab)}
            className="b3-tab"
            data-active={isActive ? "true" : undefined}
          >
            {tab.label} · {count}
          </button>
        );
      })}
    </div>
  );
}
