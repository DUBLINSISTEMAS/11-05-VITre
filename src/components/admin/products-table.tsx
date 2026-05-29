"use client";

// Lista de produtos do admin — port Dublin v3 (ADR-0019, Onda A.7).
//
// Tabela `b3-tbl` pixel-perfect. Click em row navega pra /admin/produtos/[id]
// (Next 15 prefetch). a11y: <tr> com tabIndex + role=button + onKeyDown +
// aria-label (mesmo pattern A.6).
//
// Colunas: checkbox / FOTO (b3-avatar) / NOME / CATEGORIA (b3-pill) /
// ESTOQUE (mono right) / PREÇO (mono right, promo c/ strikethrough) / STATUS.
// SKU do handoff omitido — Mangos Pay schema atual sem SKU em productTable.
//
// Selection state pra <BulkActionsToolbar> preservado. Stop propagation
// no checkbox pra não disparar navegação.
import { PackageIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, hasActivePromo } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { InlineCostCell } from "./inline-cost-cell";
import {
  OPEN_PRODUCT_FORM_EVENT,
  type OpenProductFormEventDetail,
} from "./product-form-events";
import { StockMovementDialog } from "./stock-movement-dialog";

function openProductDrawer(productId: string) {
  window.dispatchEvent(
    new CustomEvent<OpenProductFormEventDetail>(OPEN_PRODUCT_FORM_EVENT, {
      detail: { productId },
    }),
  );
}

export interface ProductTableRow {
  id: string;
  name: string;
  slug: string;
  basePriceInCents: number;
  promoPriceInCents: number | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  isActive: boolean;
  isPublishedToStorefront: boolean;
  trackStock: boolean;
  stockQuantity: number | null;
  cover: string | null;
  /** Nome da categoria (server-resolved via map). null se sem categoria. */
  categoryName: string | null;
  /**
   * Onda 1.4 (2026-05-24) — quantas variantes o produto tem.
   * Usado pelo botão "+" inline na coluna ESTOQUE: produto com variantes
   * NÃO permite movimentação rápida (precisa abrir a tela do produto pra
   * escolher qual variante). Botão fica desabilitado com tooltip.
   */
  variantCount: number;
  /**
   * PP7 (handoff pixel-perfect 2026-05-25) — código interno do produto
   * exibido na coluna SKU. NULL quando lojista não cadastrou.
   */
  sku?: string | null;
  /**
   * PP7 — custo unitário em centavos pra coluna Custo + cálculo da
   * coluna Margem inline ((base − cost) / base * 100). NULL quando não
   * cadastrado — exibe "—" + margem fica "—".
   */
  costPriceInCents?: number | null;
  /**
   * R2 Semana 4 (2026-05-28) — universo do produto pra coluna TIPO.
   * Combinado com `isPublishedToStorefront` deriva o label visível:
   *   raw_material  → "Item de gestão"
   *   service       → "Serviço"
   *   finished_good && published → "Produto público"
   *   finished_good && !published → "Produto interno"
   */
  kind: "raw_material" | "finished_good" | "service";
}

export interface ProductsTableProps {
  products: ReadonlyArray<ProductTableRow>;
  /**
   * Onda M3 (2026-05-29) — quando true, ativa modo "bulk-edit inline":
   * a celula CUSTO de cada linha vira input editavel com auto-save
   * debounced. Recupera o fluxo "preencher 30 produtos sem custo em
   * 10min" que se perdeu com a delecao da tela /admin/produtos/custos
   * (L1). Ativado automaticamente pela page quando filtro
   * `?status=no-cost` esta ativo.
   */
  inlineEditCost?: boolean;
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "··";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ProductsTable({
  products,
  inlineEditCost = false,
}: ProductsTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Onda M3 — estado local de custos editados (productId -> cents).
  // Atualizado pelo InlineCostCell ao salvar, usado pra reagir a SOBRA
  // sem precisar refetch server-side. Refresh do router cuida da
  // sincronizacao final.
  const [localCosts, setLocalCosts] = useState<Map<string, number | null>>(
    new Map(),
  );

  const allIds = useMemo(() => products.map((p) => p.id), [products]);
  const allSelected = allIds.length > 0 && selectedIds.size === allIds.length;
  const partialSelected = selectedIds.size > 0 && !allSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(allIds) : new Set());
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleMutated = () => {
    clearSelection();
    router.refresh();
  };

  return (
    <>
      <table className="b3-tbl">
        <thead>
          <tr>
            <th style={{ paddingLeft: 20, width: 40 }}>
              <span className="flex items-center justify-center">
                <Checkbox
                  aria-label="Selecionar todos"
                  checked={allSelected || (partialSelected && "indeterminate")}
                  onCheckedChange={(c) => toggleAll(c === true)}
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
            </th>
            <th style={{ width: 64 }}>FOTO</th>
            <th>NOME</th>
            <th>SKU</th>
            <th>CATEGORIA</th>
            <th>TIPO</th>
            <th style={{ textAlign: "right" }}>ESTOQUE</th>
            <th style={{ textAlign: "right" }}>CUSTO</th>
            <th style={{ textAlign: "right" }}>PREÇO</th>
            <th style={{ textAlign: "right" }}>SOBRA</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const isDraft = !p.name.trim() || p.slug.startsWith("draft-");
            const onPromoNow = hasActivePromo(p);
            const isSelected = selectedIds.has(p.id);
            return (
              <tr
                key={p.id}
                onClick={() => openProductDrawer(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openProductDrawer(p.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Editar ${p.name || "rascunho"}`}
                className={cn(
                  "cursor-pointer outline-none focus-visible:bg-bg-app",
                  isSelected && "bg-brand-wash",
                )}
              >
                <td style={{ paddingLeft: 20 }} onClick={(e) => e.stopPropagation()}>
                  <span className="flex items-center justify-center">
                    <Checkbox
                      aria-label={`Selecionar ${p.name || "rascunho"}`}
                      checked={isSelected}
                      onCheckedChange={(c) => toggleOne(p.id, c === true)}
                    />
                  </span>
                </td>
                <td>
                  <span className="b3-avatar relative overflow-hidden" style={{ borderRadius: 6 }}>
                    {p.cover ? (
                      <Image
                        src={p.cover}
                        alt=""
                        fill
                        sizes="36px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mono text-[11px] font-bold text-brand"
                        style={{ color: "var(--brand)" }}
                      >
                        {isDraft ? <PackageIcon className="size-4" /> : getInitials(p.name)}
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>
                  {isDraft ? (
                    <span className="italic text-ink-4">Rascunho sem nome</span>
                  ) : (
                    p.name
                  )}
                </td>
                <td className="mono text-ink-3" style={{ fontSize: 12 }}>
                  {p.sku?.trim() ? (
                    p.sku
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td>
                  {p.categoryName ? (
                    <span className="b3-pill">{p.categoryName}</span>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
                <td>
                  <TypePill
                    kind={p.kind}
                    isPublishedToStorefront={p.isPublishedToStorefront}
                  />
                </td>
                <td className="mono" style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                  <StockCell
                    productId={p.id}
                    productName={p.name}
                    trackStock={p.trackStock}
                    quantity={p.stockQuantity}
                    variantCount={p.variantCount}
                  />
                </td>
                <td className="mono text-ink-4" style={{ textAlign: "right", fontSize: 12.5 }}>
                  {inlineEditCost ? (
                    <InlineCostCell
                      productId={p.id}
                      productName={p.name}
                      initialCostInCents={p.costPriceInCents ?? null}
                      onCostChange={(next) => {
                        setLocalCosts((prev) => {
                          const m = new Map(prev);
                          m.set(p.id, next);
                          return m;
                        });
                      }}
                    />
                  ) : typeof p.costPriceInCents === "number" ? (
                    formatBRL(p.costPriceInCents)
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                  {onPromoNow ? (
                    <>
                      {formatBRL(p.promoPriceInCents!)}
                      <br />
                      <small className="text-ink-4" style={{ textDecoration: "line-through", fontSize: 10.5, fontWeight: 400 }}>
                        {formatBRL(p.basePriceInCents)}
                      </small>
                    </>
                  ) : (
                    formatBRL(p.basePriceInCents)
                  )}
                </td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                  <SobraCell
                    basePriceInCents={p.basePriceInCents}
                    promoPriceInCents={onPromoNow ? p.promoPriceInCents : null}
                    costPriceInCents={
                      // Onda M3 — usa custo local (recem-editado inline)
                      // se houver, senao o do server. Sobra atualiza em
                      // tempo real conforme lojista digita.
                      localCosts.has(p.id)
                        ? localCosts.get(p.id) ?? null
                        : p.costPriceInCents
                    }
                  />
                </td>
                <td>
                  <StatusPill isActive={p.isActive} isDraft={isDraft} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        onMutated={handleMutated}
      />
    </>
  );
}

function StockCell({
  productId,
  productName,
  trackStock,
  quantity,
  variantCount,
}: {
  productId: string;
  productName: string;
  trackStock: boolean;
  quantity: number | null;
  variantCount: number;
}) {
  if (!trackStock) {
    // Onda 1.4 (2026-05-24): substituído "—" silencioso por badge explícito.
    // Antes lojista olhava a tabela e via "—" sem entender que esse produto
    // está FORA do controle de estoque. Badge gera atrito visual proposital
    // (cinza neutro, sem cor de alerta) e tooltip explica o significado.
    return (
      <span
        className="b3-pill"
        title="Sem controle de estoque — produto não entra em relatórios. Ative em 'Editar produto' se for venda física."
      >
        Sem controle
      </span>
    );
  }
  const q = quantity ?? 0;
  // Onda 1.4 — botão "+" inline pra movimentação rápida sem abrir o produto.
  // Produto COM variantes não suporta movimentação rápida (precisa escolher
  // qual variante movimentar) — botão fica desabilitado com tooltip apontando
  // o caminho. Caso comum (sem variantes) = 2 cliques: tabela → "+" → dialog.
  const hasVariants = variantCount > 0;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className={cn("tabular-nums", q === 0 && "text-danger")}>{q}</span>
      {hasVariants ? (
        <button
          type="button"
          disabled
          className="b3-btn b3-btn--sm size-6 p-0 opacity-40"
          style={{ minWidth: 24 }}
          title="Produto com variantes — abra o produto para movimentar a variante específica."
          aria-label="Movimentar estoque (variantes — abra o produto)"
        >
          <PlusIcon size={12} aria-hidden />
        </button>
      ) : (
        <StockMovementDialog
          productId={productId}
          productName={productName}
          variants={[]}
          currentStockQuantity={q}
          trigger={
            <button
              type="button"
              className="b3-btn b3-btn--sm size-6 p-0"
              style={{ minWidth: 24 }}
              title="Lançar movimentação rápida (entrada, saída ou ajuste)"
              aria-label="Movimentar estoque"
              onClick={(e) => e.stopPropagation()}
            >
              <PlusIcon size={12} aria-hidden />
            </button>
          }
        />
      )}
    </span>
  );
}

/**
 * Coluna SOBRA — Onda L3 (2026-05-29). Refatora a MarginCell antiga
 * (que mostrava porcentagem). Founder pediu valor absoluto: lojista
 * pequeno BR entende "essa peca da R$ 12,00" melhor que "margem 35%".
 *
 * Calcula `preco − custo` (sem taxa cartao porque cartao varia por
 * canal/parcela; a simulacao detalhada vive no card "Sobra por venda"
 * dentro do drawer). Cor semaforica:
 *   prejuizo (sobra < 0) -> vermelho
 *   apertado (margem < 10%) -> amarelo
 *   confortavel (>= 10%) -> verde
 *
 * Sem custo cadastrado -> placeholder + dica de clicar pra cadastrar.
 */
function SobraCell({
  basePriceInCents,
  promoPriceInCents,
  costPriceInCents,
}: {
  basePriceInCents: number;
  promoPriceInCents: number | null;
  costPriceInCents?: number | null;
}) {
  if (typeof costPriceInCents !== "number" || costPriceInCents < 0) {
    return (
      <span
        className="text-amber-600 text-[11px] italic"
        title="Sem custo cadastrado — abra o produto e preencha pra ver a sobra real"
      >
        Sem custo
      </span>
    );
  }
  const price = promoPriceInCents ?? basePriceInCents;
  if (price <= 0) {
    return <span className="text-ink-4">—</span>;
  }
  const sobra = price - costPriceInCents;
  const marginPct = (sobra / price) * 100;
  const color =
    sobra < 0
      ? "var(--danger)"
      : marginPct < 10
        ? "var(--warn)"
        : "var(--ok)";
  return (
    <span className="tabular-nums" style={{ color }}>
      {formatBRL(sobra)}
    </span>
  );
}

/**
 * StatusPill — binário: Rascunho / Pausado / Ativo.
 *
 * Refactor R2 Semana 4 (2026-05-28): tirou a sobrecarga de informação
 * (publicado/Só PDV/Sem estoque) que antes vivia aqui. Agora cada coluna
 * conta UMA história:
 *   - TIPO     → universo (Item de gestão / Produto público / Produto interno / Serviço)
 *   - ESTOQUE  → saldo numérico + vermelho quando zerado
 *   - STATUS   → operacional binário: tá ativo no sistema ou não?
 *
 * Lojista lê em 1 olhada: "ativo" = sendo usado em algum canal; "pausado"
 * = retirado de TODOS os canais sem deletar; "rascunho" = ainda não saiu
 * do cadastro.
 */
function StatusPill({
  isActive,
  isDraft,
}: {
  isActive: boolean;
  isDraft: boolean;
}) {
  if (isDraft) {
    return <span className="b3-pill">Rascunho</span>;
  }
  if (!isActive) {
    return <span className="b3-pill b3-pill--gold">Pausado</span>;
  }
  return <span className="b3-pill b3-pill--ok">Ativo</span>;
}

/**
 * TypePill — universo conceitual do produto (R2 Semana 4 da ressignificação).
 * Deriva de `kind` + `isPublishedToStorefront`:
 *   - raw_material  → "Item de gestão"  (cinza, não vende em canal)
 *   - service       → "Serviço"         (azul)
 *   - finished_good && published → "Produto público"  (verde, na loja online)
 *   - finished_good && !published → "Produto interno" (cinza, só balcão/WA)
 *
 * O combo "publicado" sai da coluna STATUS pra cá — é informação de
 * canal/escopo, não de operação.
 */
export function TypePill({
  kind,
  isPublishedToStorefront,
}: {
  kind: "raw_material" | "finished_good" | "service";
  isPublishedToStorefront: boolean;
}) {
  if (kind === "raw_material") {
    return (
      <span
        className="b3-pill"
        title="Matéria-prima ou ativo. Não vende em canal nenhum."
      >
        Item de gestão
      </span>
    );
  }
  if (kind === "service") {
    return (
      <span className="b3-pill b3-pill--silver" title="Serviço — sem estoque físico.">
        Serviço
      </span>
    );
  }
  if (!isPublishedToStorefront) {
    return (
      <span
        className="b3-pill b3-pill--silver"
        title="Vende no balcão e WhatsApp, mas não aparece na loja online."
      >
        Produto interno
      </span>
    );
  }
  return (
    <span
      className="b3-pill b3-pill--ok"
      title="Aparece na loja online + PDV + WhatsApp."
    >
      Produto público
    </span>
  );
}
