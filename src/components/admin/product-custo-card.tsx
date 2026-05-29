"use client";

/**
 * Bloco F (2026-05-29) — `ProductCustoCard`.
 *
 * Substitui a "linha de tabela" do cost-grid antigo por um CARD por produto
 * que responde TUDO que o lojista precisa pra preencher custo de UM item:
 *
 *   1. Identidade — foto, nome, categoria/marca, código interno
 *   2. Preço de venda — read-only (workbench, não cadastro)
 *   3. Custo + Comissão padrão — editáveis inline, auto-save debounced
 *   4. Materiais (cost components) — adicionar/remover/editar inline; ao
 *      salvar atualiza `product.cost_price_in_cents` com a SOMA dos
 *      materiais (action canônica `saveCostComponents`)
 *   5. Simulador de lucro líquido — pills "Dinheiro / Crédito 1x / 6x / 12x"
 *      recalculam a margem usando `calculateNetProfit` + taxas reais da loja
 *
 * Decisão founder 2026-05-29 (Opção 2 — radical):
 *   "Cadastra valor, materiais que gastei, taxa de cartão se tem ou não,
 *    qual o meu lucro líquido — tudo num lugar só, sem saltar pra 7 abas."
 *
 * O drawer cheio (modo edit completo) continua acessível via menu "⋮" pra
 * casos avançados (variantes, fotos múltiplas, atacado, NCM, etc).
 */

import {
  CheckCircle2Icon,
  ImageIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveCostComponents } from "@/actions/product/cost-components";
import type { CustoProductRow } from "@/actions/product/load-for-custo";
import { updateProductCostBatch } from "@/actions/product/update-cost-batch";
import { PriceInput } from "@/components/admin/price-input";
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
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/pricing";
import {
  calculateNetProfit,
  DEFAULT_STORE_FEES,
  type PaymentMethodCategory,
  type StoreFeeConfig,
} from "@/lib/pricing/net-profit";
import { cn } from "@/lib/utils";

const AUTOSAVE_DEBOUNCE_MS = 2500;

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface ScenarioOption {
  key: string;
  label: string;
  method: PaymentMethodCategory;
  installments: number;
}

const SCENARIOS: ScenarioOption[] = [
  { key: "cash", label: "Dinheiro / PIX", method: "cash", installments: 1 },
  { key: "credit-1x", label: "Crédito 1×", method: "credit", installments: 1 },
  { key: "credit-6x", label: "Crédito 6×", method: "credit", installments: 6 },
  { key: "credit-12x", label: "Crédito 12×", method: "credit", installments: 12 },
];

interface ProductCustoCardProps {
  product: CustoProductRow;
  storeFees: StoreFeeConfig;
}

function parsePercentInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace("%", "").replace(",", ".");
  if (!cleaned) return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0 || num > 100) return undefined;
  return Math.round(num * 100);
}

function formatBpsAsPct(bps: number | null): string {
  if (bps === null) return "";
  return (bps / 100).toString().replace(".", ",");
}

interface MaterialRow {
  label: string;
  amountInCents: number | null;
}

export function ProductCustoCard({ product, storeFees }: ProductCustoCardProps) {
  // ---- Custo + Comissão (auto-save debounced) ----
  const [costPriceInCents, setCostPriceInCents] = useState<number | null>(
    product.costPriceInCents,
  );
  const [commissionBps, setCommissionBps] = useState<number | null>(
    product.defaultCommissionBps,
  );
  const [originalCost, setOriginalCost] = useState<number | null>(
    product.costPriceInCents,
  );
  const [originalCommission, setOriginalCommission] = useState<number | null>(
    product.defaultCommissionBps,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    product.costPriceInCents === null ? "idle" : "idle",
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Materiais (cost components — controlados separadamente) ----
  const [materials, setMaterials] = useState<MaterialRow[]>(
    product.costComponents.map((c) => ({
      label: c.label,
      amountInCents: c.amountInCents,
    })),
  );
  const [materialsExpanded, setMaterialsExpanded] = useState(
    product.costComponents.length > 0,
  );
  const [materialsSaving, startMaterialsSave] = useTransition();
  const materialsTotal = materials.reduce(
    (acc, m) => acc + (m.amountInCents ?? 0),
    0,
  );
  const materialsDirty =
    materials.length !== product.costComponents.length ||
    materials.some((m, i) => {
      const orig = product.costComponents[i];
      return (
        !orig ||
        m.label !== orig.label ||
        (m.amountInCents ?? 0) !== orig.amountInCents
      );
    });

  // ---- Simulador inline (pill ativo) ----
  const [scenarioKey, setScenarioKey] = useState<string>("cash");
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey) ?? SCENARIOS[0]!;

  // ---- Limpa debounce no unmount ----
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const persist = useCallback(async () => {
    const diffCost = costPriceInCents !== originalCost;
    const diffCommission = commissionBps !== originalCommission;
    if (!diffCost && !diffCommission) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    try {
      const result = await updateProductCostBatch({
        rows: [
          {
            productId: product.id,
            ...(diffCost ? { costPriceInCents } : {}),
            ...(diffCommission ? { defaultCommissionBps: commissionBps } : {}),
          },
        ],
      });
      if (!result.ok) {
        logger.error("custo.card.autosave_failed", {
          err: result.error,
          productId: product.id,
        });
        setSaveStatus("error");
        toast.error(`Erro ao salvar "${product.name}": ${result.error}`);
        return;
      }
      setOriginalCost(costPriceInCents);
      setOriginalCommission(commissionBps);
      setSaveStatus("saved");
      // Volta pra idle após 2s pra não poluir.
      setTimeout(() => {
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, 2000);
    } catch (err) {
      logger.error("custo.card.autosave_exception", {
        err,
        productId: product.id,
      });
      setSaveStatus("error");
      toast.error(`Erro ao salvar "${product.name}".`);
    }
  }, [
    costPriceInCents,
    commissionBps,
    originalCost,
    originalCommission,
    product.id,
    product.name,
  ]);

  const scheduleSave = useCallback(() => {
    setSaveStatus("dirty");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [persist]);

  const handleCostChange = (next: number | null) => {
    setCostPriceInCents(next);
    scheduleSave();
  };

  const handleCommissionChange = (raw: string) => {
    const bps = parsePercentInput(raw);
    if (bps === undefined) return; // inválido — mantém anterior
    setCommissionBps(bps);
    scheduleSave();
  };

  // ---- Materiais — handlers ----
  const updateMaterial = (i: number, patch: Partial<MaterialRow>) =>
    setMaterials((rs) =>
      rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  const addMaterial = () => {
    setMaterials((rs) => [...rs, { label: "", amountInCents: null }]);
    setMaterialsExpanded(true);
  };
  const removeMaterial = (i: number) =>
    setMaterials((rs) => rs.filter((_, idx) => idx !== i));

  const saveMaterials = () => {
    const components = materials
      .filter((m) => m.label.trim() !== "")
      .map((m) => ({
        label: m.label.trim(),
        amountInCents: m.amountInCents ?? 0,
      }));
    startMaterialsSave(async () => {
      const result = await saveCostComponents({
        productId: product.id,
        components,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Materiais SOMA → vira o custo do produto.
      setCostPriceInCents(result.totalInCents);
      setOriginalCost(result.totalInCents);
      toast.success(
        `Materiais salvos. Custo de "${product.name}" atualizado.`,
      );
    });
  };

  const openCompleteEdit = () => {
    window.dispatchEvent(
      new CustomEvent<OpenProductFormEventDetail>(OPEN_PRODUCT_FORM_EVENT, {
        detail: { productId: product.id },
      }),
    );
  };

  // ---- Simulador ----
  const profit = calculateNetProfit({
    revenueInCents: product.basePriceInCents,
    costInCents: costPriceInCents ?? 0,
    paymentMethod: scenario.method,
    installments: scenario.installments,
    commissionBps: commissionBps ?? 0,
    taxBps: 0,
    storeFees,
  });

  const profitTone =
    costPriceInCents === null
      ? "text-ink-4"
      : profit.netProfitInCents < 0
        ? "text-rose-600"
        : profit.netMarginPct < 10
          ? "text-amber-700 dark:text-amber-300"
          : "text-emerald-700 dark:text-emerald-300";

  return (
    <article className="b3-card flex flex-col gap-4 rounded-[14px] p-4 sm:p-5">
      {/* HEADER — foto + nome + meta + menu */}
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
        <StatusIndicator status={saveStatus} costNull={costPriceInCents === null} />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="text-ink-4 hover:bg-bg-app hover:text-ink-2 inline-flex size-7 items-center justify-center rounded-md outline-none transition-colors"
            aria-label="Ações do produto"
          >
            <MoreVerticalIcon className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onSelect={openCompleteEdit} className="gap-2">
              <PencilIcon className="size-3.5" aria-hidden />
              Editar completo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* PREÇO + CUSTO + COMISSÃO */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
            Preço venda
          </p>
          <p className="text-ink-1 text-[15px] font-semibold tabular-nums">
            {formatBRL(product.basePriceInCents)}
          </p>
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`cost-${product.id}`}
            className="text-ink-4 block text-[10.5px] font-bold uppercase tracking-[0.06em]"
          >
            Custo
          </label>
          <PriceInput
            id={`cost-${product.id}`}
            value={costPriceInCents}
            onChange={handleCostChange}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`comm-${product.id}`}
            className="text-ink-4 block text-[10.5px] font-bold uppercase tracking-[0.06em]"
          >
            Comissão %
          </label>
          <div className="relative">
            <input
              id={`comm-${product.id}`}
              type="text"
              inputMode="decimal"
              defaultValue={formatBpsAsPct(commissionBps)}
              onChange={(e) => handleCommissionChange(e.target.value)}
              placeholder="0"
              className="b3-input h-9 w-full pr-7 tabular-nums"
            />
            <span className="text-ink-4 absolute top-1/2 right-3 -translate-y-1/2 text-[12px]">
              %
            </span>
          </div>
        </div>
      </div>

      {/* MATERIAIS — expansível */}
      <section className="border-line rounded-[10px] border bg-bg-app/40">
        <button
          type="button"
          onClick={() => setMaterialsExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        >
          <span className="text-ink-2 text-[12px] font-semibold">
            <PackageIcon
              className="mr-1.5 inline size-3.5"
              aria-hidden
            />
            Materiais{" "}
            <span className="text-ink-4 font-normal">
              ({materials.length})
            </span>
          </span>
          <span className="text-ink-3 text-[11.5px] tabular-nums">
            {materials.length > 0
              ? `soma ${formatBRL(materialsTotal)}`
              : "nenhum cadastrado"}
          </span>
        </button>

        {materialsExpanded ? (
          <div className="space-y-2 border-t border-line/60 px-3 py-3">
            {materials.length === 0 ? (
              <p className="text-ink-4 text-[11.5px]">
                Adicione materiais (ouro, mão-de-obra, embalagem) pra
                calcular o custo composto. A soma vira o &ldquo;Custo&rdquo;
                acima.
              </p>
            ) : (
              materials.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Material (ex: Ouro 18k 4g)"
                    value={m.label}
                    onChange={(e) =>
                      updateMaterial(i, { label: e.target.value })
                    }
                    className="b3-input h-8 flex-1 text-[12.5px]"
                    maxLength={120}
                  />
                  <div className="w-36">
                    <PriceInput
                      value={m.amountInCents}
                      onChange={(v) => updateMaterial(i, { amountInCents: v })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMaterial(i)}
                    className="text-ink-4 hover:text-destructive inline-flex size-7 items-center justify-center rounded-md transition-colors"
                    aria-label="Remover material"
                  >
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))
            )}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={addMaterial}
                className="text-mangos-green-800 hover:text-mangos-green-900 inline-flex items-center gap-1 text-[11.5px] font-semibold"
              >
                <PlusIcon className="size-3.5" aria-hidden />
                Adicionar material
              </button>
              {materialsDirty ? (
                <button
                  type="button"
                  onClick={saveMaterials}
                  disabled={materialsSaving}
                  className="b3-btn b3-btn--sm b3-btn--primary"
                >
                  {materialsSaving ? (
                    <Loader2Icon
                      className="size-3.5 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <SaveIcon className="size-3.5" aria-hidden />
                  )}
                  Salvar materiais
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* SIMULADOR de lucro líquido */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
            Lucro líquido se vender por
          </p>
        </div>
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
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="space-y-0.5">
            {costPriceInCents === null ? (
              <p className="text-ink-4 text-[12px]">
                Cadastre o custo pra ver o lucro real.
              </p>
            ) : (
              <p className="text-ink-3 text-[11px]">
                Receita {formatBRL(product.basePriceInCents)} − custo{" "}
                {formatBRL(costPriceInCents)} − cartão{" "}
                {formatBRL(profit.paymentFeeInCents)}
                {profit.commissionInCents > 0
                  ? ` − comissão ${formatBRL(profit.commissionInCents)}`
                  : ""}
              </p>
            )}
          </div>
          <div className={cn("text-right", profitTone)}>
            <p className="text-[18px] font-bold leading-none tabular-nums">
              {costPriceInCents === null
                ? "—"
                : formatBRL(profit.netProfitInCents)}
            </p>
            <p className="text-[11px] tabular-nums opacity-80">
              {costPriceInCents === null
                ? ""
                : `${profit.netMarginPct.toFixed(1).replace(".", ",")}% de margem`}
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

function StatusIndicator({
  status,
  costNull,
}: {
  status: SaveStatus;
  costNull: boolean;
}) {
  if (status === "saving") {
    return (
      <span
        className="text-ink-3 inline-flex size-7 items-center justify-center"
        title="Salvando"
      >
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span
        className="text-emerald-600 inline-flex size-7 items-center justify-center dark:text-emerald-400"
        title="Salvo"
      >
        <CheckCircle2Icon className="size-4" aria-hidden />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="text-destructive inline-flex size-7 items-center justify-center"
        title="Erro ao salvar"
      >
        <TriangleAlertIcon className="size-4" aria-hidden />
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span
        className="text-amber-600 inline-flex size-7 items-center justify-center dark:text-amber-400"
        title="Alterado, salvando em alguns segundos"
      >
        <SaveIcon className="size-4" aria-hidden />
      </span>
    );
  }
  if (costNull) {
    return (
      <span
        className="text-amber-600 inline-flex size-7 items-center justify-center dark:text-amber-400"
        title="Sem custo cadastrado"
      >
        <TriangleAlertIcon className="size-4" aria-hidden />
      </span>
    );
  }
  return <span className="inline-flex size-7" aria-hidden />;
}

// Suprime warning de DEFAULT_STORE_FEES não usado em runtime — exportado
// pra testes manuais. Mantido pra eventual fallback se storeFees vier null
// (não acontece hoje, page.tsx garante).
export { DEFAULT_STORE_FEES as _defaultStoreFees };
