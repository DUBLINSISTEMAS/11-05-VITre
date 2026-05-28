// PegandoFogo — Bloco F.2.2 da ressignificação (2026-05-28).
//
// "Pegando fogo agora" — painel curto e direto do que precisa de atenção
// HOJE. NÃO é fila acumulada; cada sinal é DELTA (vencendo hoje, novo nas
// últimas 24h, urgente desde já). Quando vazio, mostra "Tudo em dia" —
// confiança ganha por subtração.
//
// Decisões do conselho (2026-05-28):
//   - 4 categorias curadas: caixa esquecido, WhatsApp pendente, fiado
//     vencido/vencendo hoje, estoque que ENTROU em mínimo nas últimas 24h.
//   - Cada item leva a uma tela de RESOLUÇÃO (PDV de caixa, drawer
//     da venda, /admin/financeiro/receber filtrado, /admin/estoque?low).
//   - Severity colors: high (vermelho), med (âmbar), low (cinza neutro).
//   - Vocabulário do balcão: "Caixa aberto há Xh sem fechar", "fiado em
//     atraso", "produto entrou em estoque mínimo". Zero "warnings",
//     "alerts", "notifications".
//
// Server component (zero bundle client). Render condicional do empty
// state quando allClear=true.

import { ChevronRightIcon, FlameIcon } from "lucide-react";
import Link from "next/link";

import type { DashboardSinal } from "@/actions/dashboard/load-sinais";

interface PegandoFogoProps {
  items: DashboardSinal[];
  allClear: boolean;
}

export function PegandoFogo({ items, allClear }: PegandoFogoProps) {
  return (
    <section className="b3-pegando-fogo" aria-label="Pegando fogo agora">
      <header className="b3-pegando-fogo-hd">
        <h2 className="b3-pegando-fogo-title">
          <FlameIcon size={14} aria-hidden className="b3-pegando-fogo-icon" />
          Pegando fogo agora
        </h2>
        {!allClear ? (
          <span className="b3-pegando-fogo-counter">
            {items.length} {items.length === 1 ? "ponto" : "pontos"}
          </span>
        ) : null}
      </header>

      {allClear ? (
        <EmptyState />
      ) : (
        <ul className="b3-pegando-fogo-list">
          {items.map((item) => (
            <SinalRow key={item.type} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ============================================================================
// Linha do sinal — link clicável full-width
// ============================================================================

function SinalRow({ item }: { item: DashboardSinal }) {
  const sevClass =
    item.severity === "high"
      ? "b3-sinal-row--high"
      : item.severity === "med"
        ? "b3-sinal-row--med"
        : "b3-sinal-row--low";

  return (
    <li>
      <Link
        href={item.href}
        prefetch
        className={`b3-sinal-row ${sevClass}`}
      >
        <span className="b3-sinal-dot" aria-hidden />
        <div className="b3-sinal-content">
          <p className="b3-sinal-title">{item.title}</p>
          {item.subtitle ? (
            <p className="b3-sinal-sub">{item.subtitle}</p>
          ) : null}
        </div>
        <ChevronRightIcon
          size={14}
          aria-hidden
          className="b3-sinal-chev"
        />
      </Link>
    </li>
  );
}

// ============================================================================
// Empty state — vocabulário cordial BR
// ============================================================================

function EmptyState() {
  return (
    <div className="b3-pegando-fogo-empty">
      <span aria-hidden className="b3-pegando-fogo-empty-icon">
        🤝
      </span>
      <p className="b3-pegando-fogo-empty-msg">Tudo em dia por aqui.</p>
      <p className="b3-pegando-fogo-empty-hint">
        Caixa fechado, fiados em dia, estoque ok e WhatsApp respondido.
        Bom trabalho.
      </p>
    </div>
  );
}
