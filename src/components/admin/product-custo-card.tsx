"use client";

/**
 * Bloco F.1 (2026-05-29) — `ProductCustoCard` redesign.
 *
 * Conselho dos 5 agentes 2026-05-29 decidiu eliminar a duplicação de
 * formulário: o card NÃO edita custo/comissão/materiais inline. Quem
 * preenche/ajusta abre o `ProductFormModal` na aba "Preço & custo".
 *
 * Dois layouts:
 *   - SEM CUSTO  → card limpo, foco em CTA "Preencher custo" (urgência).
 *   - COM CUSTO  → resumo visual (Preço/Custo/Sobra) + simulador de
 *                  parcelas (read-only) + CTA "Ajustar custo" pro drawer.
 *
 * Vocabulário pé-no-chão: "Sobra por venda" em vez de "Lucro líquido",
 * "Taxa do cartão" em vez de "Fee BPS", "Preço de venda" em vez de
 * "Receita". Founder mandou alinhar com o varejo BR de balcão.
 */

import {
  ArrowRightIcon,
  ImageIcon,
  MoreVerticalIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import type { CustoProductRow } from "@/actions/product/load-for-custo";
import {
  OPEN_PRODUCT_FORM_EVENT,
  type OpenProductFormEventDetail,
} from "@/components/admin/product-form-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBRL } from "@/lib/pricing";
import {
  calculateNetProfit,
  type PaymentMethodCategory,
  type StoreFeeConfig,
} from "@/lib/pricing/net-profit";
import { cn } from "@/lib/utils";

interface ScenarioOption {
  key: string;
  label: string;
  method: PaymentMethodCategory;
  installments: number;
}

const SCENARIOS: ScenarioOption[] = [
  { key: "cash", label: "À vista / PIX", method: "cash", installments: 1 },
  { key: "credit-1x", label: "Crédito 1×", method: "credit", installments: 1 },
  { key: "credit-6x", label: "Crédito 6×", method: "credit", installments: 6 },
  { key: "credit-12x", label: "Crédito 12×", method: "credit", installments: 12 },
];

interface ProductCustoCardProps {
  product: CustoProductRow;
  storeFees: StoreFeeConfig;
}

function openProductDrawer(productId: string) {
  window.dispatchEvent(
    new CustomEvent<OpenProductFormEventDetail>(OPEN_PRODUCT_FORM_EVENT, {
      detail: { productId, initialTab: "preco" },
    }),
  );
}

export function ProductCustoCard({ product, storeFees }: ProductCustoCardProps) {
  const hasCost = product.costPriceInCents !== null;

  return (
    <article
      className={cn(
        "b3-card flex flex-col gap-4 rounded-[14px] p-4 sm:p-5",
        !hasCost && "border-amber-300/40 bg-amber-50/30 dark:bg-amber-950/10",
      )}
    >
      <CardHeader product={product} hasCost={hasCost} />
      {hasCost ? (
        <FilledCardBody product={product} storeFees={storeFees} />
      ) : (
        <EmptyCardBody product={product} />
      )}
    </article>
  );
}

// =====================================================================
// Header — comum aos dois layouts
// =====================================================================

function CardHeader({
  product,
  hasCost,
}: {
  product: CustoProductRow;
  hasCost: boolean;
}) {
  return (
    <header className="flex items-start gap-3">
      <div className="bg-bg-app border-line relative size-12 shrink-0 overflow-hidden rounded-[10px] border">
        {product.coverImageUrl ? (
          <Image
            src={product.coverImageUrl}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="text-ink-4 flex h-full items-center justify-center">
            <ImageIcon className="size-5" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-ink-1 line-clamp-1 text-[14px] font-semibold leading-tight">
          {product.name}
        </h3>
        <p className="text-ink-4 mt-0.5 line-clamp-1 text-[11.5px]">
          {[product.categoryName, product.brand, product.internalCode]
            .filter(Boolean)
            .join(" · ") || "Sem categoria nem marca"}
        </p>
      </div>
      {!hasCost ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          title="Custo ainda não cadastrado"
        >
          <TriangleAlertIcon className="size-3" aria-hidden />
          Sem custo
        </span>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="text-ink-4 hover:bg-bg-app hover:text-ink-2 inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors"
          aria-label="Ações do produto"
        >
          <MoreVerticalIcon className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem
            onSelect={() => openProductDrawer(product.id)}
            className="gap-2"
          >
            <PencilIcon className="size-3.5" aria-hidden />
            Abrir cadastro completo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// =====================================================================
// Body — produto SEM custo (foco em CTA)
// =====================================================================

function EmptyCardBody({ product }: { product: CustoProductRow }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
          Preço de venda
        </p>
        <p className="text-ink-1 mt-0.5 text-[18px] font-semibold tabular-nums">
          {formatBRL(product.basePriceInCents)}
        </p>
      </div>

      <p className="text-ink-3 text-[12px] leading-snug">
        Sem custo cadastrado, ainda não dá pra saber o lucro real desta peça.
        Preenche materiais e taxa do cartão pra ver quanto sobra.
      </p>

      <button
        type="button"
        onClick={() => openProductDrawer(product.id)}
        className="b3-btn b3-btn--cta w-full justify-center"
      >
        Preencher custo
        <ArrowRightIcon className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

// =====================================================================
// Body — produto COM custo (resumo + simulador read-only)
// =====================================================================

function FilledCardBody({
  product,
  storeFees,
}: {
  product: CustoProductRow;
  storeFees: StoreFeeConfig;
}) {
  const [scenarioKey, setScenarioKey] = useState<string>("cash");
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]!;

  const costInCents = product.costPriceInCents ?? 0;
  const profit = calculateNetProfit({
    revenueInCents: product.basePriceInCents,
    costInCents,
    paymentMethod: scenario.method,
    installments: scenario.installments,
    commissionBps: product.defaultCommissionBps ?? 0,
    taxBps: 0,
    storeFees,
  });

  const sobraTone =
    profit.netProfitInCents < 0
      ? "text-rose-600"
      : profit.netMarginPct < 10
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  const materialsCount = product.costComponents.length;

  return (
    <div className="space-y-4">
      {/* RESUMO — Preço / Custo / Sobra */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCell
          label="Preço de venda"
          value={formatBRL(product.basePriceInCents)}
        />
        <SummaryCell
          label="Custo"
          value={formatBRL(costInCents)}
          sub={materialsCount > 0 ? `${materialsCount} materiais` : null}
        />
        <SummaryCell
          label="Sobra"
          value={formatBRL(profit.netProfitInCents)}
          tone={sobraTone}
          strong
        />
      </div>

      {/* SIMULADOR — pills de método de pagamento */}
      <section className="space-y-2">
        <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
          Como o cliente paga muda quanto sobra
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SCENARIOS.map((s) => {
            const active = s.key === scenarioKey;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setScenarioKey(s.key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11.5px] transition-colors",
                  active
                    ? "bg-ink-1 text-bg-1 font-semibold"
                    : "bg-bg-app text-ink-3 hover:bg-bg-app/80",
                )}
                aria-pressed={active}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="text-ink-4 text-[11px] leading-snug">
          {formatBRL(product.basePriceInCents)} − custo{" "}
          {formatBRL(costInCents)} − taxa do cartão{" "}
          {formatBRL(profit.paymentFeeInCents)}
          {profit.commissionInCents > 0
            ? ` − comissão ${formatBRL(profit.commissionInCents)}`
            : ""}
          {" = "}
          <span className={cn("font-semibold tabular-nums", sobraTone)}>
            {formatBRL(profit.netProfitInCents)}
          </span>{" "}
          ({profit.netMarginPct.toFixed(1).replace(".", ",")}%)
        </p>
      </section>

      <button
        type="button"
        onClick={() => openProductDrawer(product.id)}
        className="b3-btn b3-btn--sm w-full justify-center"
      >
        <PencilIcon className="size-3.5" aria-hidden />
        Ajustar custo ou materiais
      </button>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  tone,
  strong,
}: {
  label: string;
  value: string;
  sub?: string | null;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
        {label}
      </p>
      <p
        className={cn(
          "tabular-nums leading-tight",
          strong ? "text-[18px] font-bold" : "text-[15px] font-semibold",
          tone ?? "text-ink-1",
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className="text-ink-4 text-[10.5px] leading-tight">{sub}</p>
      ) : null}
    </div>
  );
}
