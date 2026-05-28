// ProdutosBombando — Bloco F.2.3 da ressignificação (2026-05-28).
//
// "Produtos que tão bombando essa semana" — substitui o "Top 3 lucro
// absoluto" do plano original. Critério: aceleração relativa ≥ 30% vs
// média móvel diária dos 28 dias anteriores. Surpresa positiva > completude.
//
// Conselho 2026-05-28:
//   - Top por lucro absoluto destaca SEMPRE os mesmos itens caros. Sandra
//     já sabe que aliança vende. Quer saber qual brinco acelerou.
//   - Fallback Top 3 por lucro absoluto quando loja jovem sem 28d de
//     histórico ou sem candidato acima do gatilho — label muda pra
//     "Top 3 da semana" (sinaliza que é fallback, não aceleração real).
//   - Layout: lista densa, 3 linhas máximo, imagem 36×36 + nome + métrica
//     contextual ("+85% vs média" OR "R$ X faturado"). Tabular-nums.
//
// Server component (zero bundle client).

import { TrendingUpIcon } from "lucide-react";
import Link from "next/link";

import type { ProdutoBombando } from "@/actions/dashboard/load-bombando";
import { formatBRL } from "@/lib/pricing";

interface ProdutosBombandoProps {
  items: ProdutoBombando[];
  fallback: boolean;
}

export function ProdutosBombando({ items, fallback }: ProdutosBombandoProps) {
  // Sem dados suficientes ainda — esconde completamente em vez de mostrar
  // "Nenhum produto bombando" (confunde lojista pequeno com poucos SKUs).
  if (items.length === 0) return null;

  return (
    <section className="b3-bombando" aria-label="Produtos em destaque">
      <header className="b3-bombando-hd">
        <h2 className="b3-bombando-title">
          <TrendingUpIcon
            size={14}
            aria-hidden
            className="b3-bombando-icon"
          />
          {fallback
            ? "Top 3 da semana"
            : "Produtos que tão bombando essa semana"}
        </h2>
        {!fallback ? (
          <span className="b3-bombando-sub" title="Acima de 30% acima da média móvel de 28 dias anteriores">
            vendendo acima da média
          </span>
        ) : (
          <span className="b3-bombando-sub">
            por receita
          </span>
        )}
      </header>

      <ul className="b3-bombando-list">
        {items.map((p) => (
          <ProdutoRow key={p.productId} produto={p} fallback={fallback} />
        ))}
      </ul>
    </section>
  );
}

// ============================================================================
// Linha do produto — link pro form do produto (abre drawer)
// ============================================================================

function ProdutoRow({
  produto,
  fallback,
}: {
  produto: ProdutoBombando;
  fallback: boolean;
}) {
  const initials = produto.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li>
      <Link
        href={`/admin/produtos?edit=${produto.productId}`}
        prefetch
        className="b3-bombando-row"
      >
        {/* Thumbnail — image OR fallback iniciais */}
        {produto.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imageUrl}
            alt=""
            loading="lazy"
            className="b3-bombando-thumb"
          />
        ) : (
          <span aria-hidden className="b3-bombando-thumb b3-bombando-thumb--placeholder">
            {initials || "—"}
          </span>
        )}

        <div className="b3-bombando-info">
          <p className="b3-bombando-name">{produto.name}</p>
          <p className="b3-bombando-meta">
            {produto.qtyCurrent} {produto.qtyCurrent === 1 ? "venda" : "vendas"}{" "}
            essa semana
            {produto.revenueInCents > 0 ? (
              <>
                {" · "}
                <span className="font-mono tabular-nums">
                  {formatBRL(produto.revenueInCents)}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="b3-bombando-metric">
          {!fallback && produto.accelerationMultiplier !== null ? (
            <AccelerationBadge multiplier={produto.accelerationMultiplier} />
          ) : produto.profitAbsoluteInCents !== null ? (
            <span className="b3-bombando-profit">
              {formatBRL(produto.profitAbsoluteInCents)}
              <span className="b3-bombando-profit-label">de lucro</span>
            </span>
          ) : (
            <span className="b3-bombando-profit-empty">sem custo</span>
          )}
        </div>
      </Link>
    </li>
  );
}

function AccelerationBadge({ multiplier }: { multiplier: number }) {
  // 1.30 → "+30%", 2.5 → "+150%", 4 → "+300%". Trunca em "+999%" pra evitar UI overflow.
  const pct = Math.min(999, Math.round((multiplier - 1) * 100));
  return (
    <span
      className="b3-bombando-accel"
      title={`Vendendo ${pct}% acima da média diária dos últimos 28 dias`}
    >
      <TrendingUpIcon size={11} aria-hidden />+{pct}%
    </span>
  );
}
