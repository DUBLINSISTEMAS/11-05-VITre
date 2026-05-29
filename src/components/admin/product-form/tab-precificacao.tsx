"use client";

/**
 * Tab Precificação — Bloco G da ressignificação (2026-05-27).
 *
 * Workbench READ-ONLY que materializa o pedido do cliente joalheiro:
 * "essa aliança custou X, materiais Y, taxa Z — quanto sobra?".
 *
 * Consome o helper canônico `calculateNetProfit` pra cada forma de
 * pagamento + parcelas relevantes e renderiza tabela viva com colunas:
 *   Forma de pagamento | Recebe | Custo | Lucro R$ | Lucro %
 *
 * Linhas com fundo semântico:
 *   - vermelho (lucro % < 5)   → margem ruim, considere subir preço
 *   - amarelo  (5 ≤ % < 15)   → margem apertada
 *   - verde    (% ≥ 15)       → saudável
 *
 * Sem inputs próprios — o input "Preço de venda" + "Custo" vivem na aba
 * "Preço & Custo". Esta aba só LÊ os valores via watch e calcula.
 * Filosofia: sistema profissional substitui o Excel — não imita.
 */
import { AlertCircleIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ProductFormValues } from "@/actions/product/schema";
import { formatBRL } from "@/lib/pricing";
import {
  calculateNetProfit,
  DEFAULT_STORE_FEES,
  type PaymentMethodCategory,
  type StoreFeeConfig,
} from "@/lib/pricing/net-profit";

export interface TabPrecificacaoProps {
  control: Control<ProductFormValues>;
  /** Configuração de taxas reais da maquininha. Vem do store carregado em loadProductFormData. */
  storeFees?: StoreFeeConfig;
  /** Comissão da loja default em bps (se produto não override). Usa pra mostrar lucro com vendedora. */
  storeDefaultCommissionBps?: number;
}

interface Scenario {
  key: string;
  label: string;
  method: PaymentMethodCategory;
  installments: number;
  hint?: string;
}

const SCENARIOS: Scenario[] = [
  { key: "pix", label: "PIX à vista", method: "pix", installments: 1 },
  { key: "debit", label: "Débito", method: "debit", installments: 1 },
  { key: "credit-1x", label: "Crédito 1×", method: "credit", installments: 1 },
  { key: "credit-3x", label: "Crédito 3×", method: "credit", installments: 3 },
  { key: "credit-6x", label: "Crédito 6×", method: "credit", installments: 6 },
  {
    key: "credit-12x",
    label: "Crédito 12×",
    method: "credit",
    installments: 12,
    hint: "sem juros, lojista absorve a taxa",
  },
];

function marginClass(pct: number): string {
  if (pct < 5) return "bg-rose-50 text-rose-900";
  if (pct < 15) return "bg-amber-50 text-amber-900";
  return "bg-emerald-50 text-emerald-900";
}

function marginDotClass(pct: number): string {
  if (pct < 5) return "bg-rose-500";
  if (pct < 15) return "bg-amber-500";
  return "bg-emerald-500";
}

export function TabPrecificacao({
  control,
  storeFees,
  storeDefaultCommissionBps,
}: TabPrecificacaoProps) {
  const basePriceInCents = useWatch({ control, name: "basePriceInCents" }) ?? 0;
  const costPriceInCents = useWatch({ control, name: "costPriceInCents" });
  const productCommissionBps = useWatch({
    control,
    name: "defaultCommissionBps",
  });

  const fees = storeFees ?? DEFAULT_STORE_FEES;
  const commissionBps =
    (productCommissionBps ?? storeDefaultCommissionBps ?? 0) || 0;

  const rows = useMemo(() => {
    if (basePriceInCents <= 0) return [];
    return SCENARIOS.map((s) => {
      const result = calculateNetProfit({
        revenueInCents: basePriceInCents,
        costInCents: costPriceInCents ?? 0,
        paymentMethod: s.method,
        installments: s.installments,
        commissionBps,
        taxBps: 0,
        storeFees: fees,
      });
      return { scenario: s, result };
    });
  }, [basePriceInCents, costPriceInCents, commissionBps, fees]);

  if (basePriceInCents <= 0) {
    return (
      <EmptyState
        title="Cadastre o preço de venda primeiro"
        body="Vá na aba Preço & custo, defina o preço de venda, e volte aqui. O workbench mostra quanto sobra de lucro em cada forma de pagamento, com taxa real do cartão deduzida."
      />
    );
  }

  // Onda 3 (2026-05-28): nota clara de "apenas leitura". Lojista que clica
  // nesta aba esperando salvar custo/comissão vira pra cá e vê tabela densa
  // sem CTA — sem essa nota, parece "tela morta".
  const READ_ONLY_NOTE = (
    <div className="b3-card flex items-start gap-2 rounded-lg border border-ink-4/15 bg-bg-app/40 p-3 text-[11.5px] leading-snug text-ink-3">
      <AlertCircleIcon className="size-3.5 shrink-0 text-ink-4" aria-hidden />
      <span>
        Apenas leitura. Pra editar preço, custo ou comissão, volte na aba{" "}
        <strong className="text-ink-2">Preço &amp; custo</strong>.
      </span>
    </div>
  );

  if (costPriceInCents === null || costPriceInCents === undefined) {
    return (
      <EmptyState
        title="Cadastre o custo do produto pra ver o lucro real"
        body={`Você definiu o preço de venda (${formatBRL(basePriceInCents)}) mas não cadastrou o custo. Sem isso, o lucro é só estimativa otimista (assume custo = 0). Vá na aba Preço & custo e preencha quanto pagou pelo produto.`}
        intent="warning"
      />
    );
  }

  return (
    <div className="space-y-4">
      {READ_ONLY_NOTE}
      {/* Resumo: preço × custo, comissão se aplicável */}
      <header className="b3-card overflow-hidden p-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
              Preço de venda
            </p>
            <p className="text-ink-1 text-[18px] font-semibold tabular-nums">
              {formatBRL(basePriceInCents)}
            </p>
          </div>
          <div className="text-ink-4 text-[16px]">−</div>
          <div>
            <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
              Custo
            </p>
            <p className="text-ink-1 text-[18px] font-semibold tabular-nums">
              {formatBRL(costPriceInCents)}
            </p>
          </div>
          {commissionBps > 0 ? (
            <>
              <div className="text-ink-4 text-[16px]">−</div>
              <div>
                <p className="text-ink-4 text-[10.5px] font-bold uppercase tracking-[0.06em]">
                  Comissão da vendedora
                </p>
                <p className="text-ink-1 text-[18px] font-semibold tabular-nums">
                  {(commissionBps / 100).toFixed(1)}%
                </p>
              </div>
            </>
          ) : null}
        </div>
        <p className="text-ink-3 mt-3 text-[12.5px]">
          Margem bruta:{" "}
          <strong className="text-ink-1 tabular-nums">
            {formatBRL(basePriceInCents - costPriceInCents)}
          </strong>{" "}
          ({(((basePriceInCents - costPriceInCents) / basePriceInCents) * 100).toFixed(1)}%).
          A margem real depende da forma de pagamento — veja abaixo:
        </p>
      </header>

      {/* Tabela viva por método */}
      <div className="b3-card overflow-hidden">
        <header className="border-b border-line bg-bg-2/40 px-4 py-3">
          <h3 className="text-ink-1 text-[13px] font-semibold">
            Lucro líquido por forma de pagamento
          </h3>
          <p className="text-ink-4 text-[11.5px]">
            Taxa real da maquininha já deduzida (vem do que você cadastrou em{" "}
            <Link
              href="/admin/pagamento"
              className="font-semibold underline"
              prefetch
            >
              /admin/pagamento
            </Link>
            ). Verde &gt;15%, amarelo 5-15%, vermelho &lt;5%.
          </p>
        </header>

        <table className="w-full border-collapse text-[12.5px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-ink-3">
              <th className="px-4 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide">
                Forma de pagamento
              </th>
              <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide">
                Taxa cartão
              </th>
              <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide">
                Você recebe
              </th>
              <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide">
                Lucro R$
              </th>
              <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-wide">
                Lucro %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ scenario, result }) => {
              const youReceive = basePriceInCents - result.paymentFeeInCents;
              const pct = result.netMarginPct;
              return (
                <tr
                  key={scenario.key}
                  className={`border-b border-line/60 ${marginClass(pct)}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`inline-block size-2 rounded-full ${marginDotClass(pct)}`}
                      />
                      <div>
                        <div className="font-semibold">{scenario.label}</div>
                        {scenario.hint ? (
                          <div className="text-[10.5px] opacity-75">
                            {scenario.hint}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {result.paymentFeeInCents === 0 ? (
                      <span className="opacity-50">—</span>
                    ) : (
                      <span>
                        −{formatBRL(result.paymentFeeInCents)}
                        <span className="ml-1 text-[10.5px] opacity-70">
                          ({(result.effectiveCardFeeBps / 100).toFixed(2)}%)
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {formatBRL(youReceive)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {result.netProfitInCents < 0 ? "−" : ""}
                    {formatBRL(Math.abs(result.netProfitInCents))}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold">
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <footer className="border-t border-line bg-bg-2/30 px-4 py-2.5 text-[11px] text-ink-4">
          <strong>Atenção:</strong> juros de cartão (parcelas com juros
          repassados ao cliente) ainda não entram nessa simulação — tela
          mostra cenário &ldquo;sem juros, taxa absorvida pelo lojista&rdquo;.
          Cobertura mais ampla virá na próxima onda.
        </footer>
      </div>

      <div className="b3-card p-4">
        <div className="flex items-start gap-3">
          <TrendingUpIcon
            className="size-5 shrink-0 text-mangos-green-800"
            aria-hidden
          />
          <div className="text-[12.5px] text-ink-2 leading-relaxed">
            <strong>Como usar:</strong> se a linha está vermelha (margem
            &lt;5%), considere subir o preço base OU bloquear essa forma de
            pagamento pra este produto (edite{" "}
            <em>Sobrescrever máximo de parcelas</em> na aba{" "}
            <em>Loja online</em>). PIX quase sempre dá mais margem porque
            não tem taxa — se quiser empurrar, ofereça desconto à vista no
            mesmo produto.
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Empty states
// =====================================================================

interface EmptyStateProps {
  title: string;
  body: string;
  intent?: "info" | "warning";
}

function EmptyState({ title, body, intent = "info" }: EmptyStateProps) {
  return (
    <div className="b3-card p-6">
      <div className="flex items-start gap-3">
        <AlertCircleIcon
          aria-hidden
          className={`size-5 shrink-0 ${intent === "warning" ? "text-amber-600" : "text-ink-4"}`}
        />
        <div>
          <h3 className="text-ink-1 text-[14px] font-semibold">{title}</h3>
          <p className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
