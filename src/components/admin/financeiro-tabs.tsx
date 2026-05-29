"use client";

/**
 * FinanceiroTabs — Onda L2 (2026-05-29).
 *
 * Switcher de 2 tabs URL-driven (`?tab=receber|pagar`) na tela
 * `/admin/financeiro`. Mantem deep-link funcional — copiar URL no chat
 * leva o sócio direto pra mesma tab.
 *
 * Tab count e tone vem do header (overview) — aqui so renderiza os botoes
 * e troca o conteudo via prop.
 */

import { ClockIcon, HandCoinsIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { formatBRL } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type FinanceiroTab = "receber" | "pagar";

interface FinanceiroTabsProps {
  current: FinanceiroTab;
  pendenteReceberInCents: number;
  pendentePagarInCents: number;
}

export function FinanceiroTabs({
  current,
  pendenteReceberInCents,
  pendentePagarInCents,
}: FinanceiroTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const setTab = (next: FinanceiroTab) => {
    if (next === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "receber") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    startTransition(() =>
      router.replace(qs ? `?${qs}` : "/admin/financeiro", { scroll: false }),
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Tabs de Financeiro"
      className="border-line flex items-center gap-1 border-b"
    >
      <TabButton
        active={current === "receber"}
        onClick={() => setTab("receber")}
        icon={<HandCoinsIcon size={14} aria-hidden />}
        label="A receber"
        suffix={formatBRL(pendenteReceberInCents)}
      />
      <TabButton
        active={current === "pagar"}
        onClick={() => setTab("pagar")}
        icon={<ClockIcon size={14} aria-hidden />}
        label="A pagar"
        suffix={formatBRL(pendentePagarInCents)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  suffix,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  suffix: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "text-ink-1 after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-mangos-green-800"
          : "text-ink-4 hover:text-ink-2",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-ink-2" : "text-ink-4",
        )}
      >
        {suffix}
      </span>
    </button>
  );
}
