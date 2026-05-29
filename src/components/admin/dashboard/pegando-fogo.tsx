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

import {
  ChevronRightIcon,
  FlameIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";

import type {
  DashboardSinal,
  SinalType,
} from "@/actions/dashboard/load-sinais";

interface PegandoFogoProps {
  items: DashboardSinal[];
  allClear: boolean;
  /** Bloco E1 UX (2026-05-29) — timestamp da última checagem. */
  checkedAt: Date;
  /** Categorias que falharam silenciosamente — UI mostra warning. */
  failedChecks: SinalType[];
}

const SINAL_TYPE_LABEL: Record<SinalType, string> = {
  caixa_esquecido: "caixa",
  whatsapp_pendente: "WhatsApp",
  fiado_atrasado: "fiados",
  estoque_critico_novo: "estoque",
  orcamento_vencendo: "orçamentos",
};

function formatCheckedAt(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function PegandoFogo({
  items,
  allClear,
  checkedAt,
  failedChecks,
}: PegandoFogoProps) {
  const hasFailures = failedChecks.length > 0;
  return (
    <section className="b3-pegando-fogo" aria-label="Pegando fogo agora">
      <header className="b3-pegando-fogo-hd">
        <h2 className="b3-pegando-fogo-title">
          <FlameIcon size={14} aria-hidden className="b3-pegando-fogo-icon" />
          Pegando fogo agora
        </h2>
        <span
          className="b3-pegando-fogo-checked"
          title={`Última checagem: ${checkedAt.toLocaleString("pt-BR")}`}
        >
          verificado às {formatCheckedAt(checkedAt)}
        </span>
        {!allClear ? (
          <span className="b3-pegando-fogo-counter">
            {items.length} {items.length === 1 ? "ponto" : "pontos"}
          </span>
        ) : null}
      </header>

      {/* Bloco E1 UX (2026-05-29) — quando alguma checagem falhou, mostra
          warning ANTES da lista/empty pra lojista não confiar em "tudo ok"
          silencioso. */}
      {hasFailures ? (
        <div className="b3-pegando-fogo-warn">
          <TriangleAlertIcon
            size={13}
            aria-hidden
            className="text-state-warning shrink-0"
          />
          <p>
            Não consegui checar{" "}
            <strong>
              {failedChecks
                .map((t) => SINAL_TYPE_LABEL[t])
                .filter(Boolean)
                .join(", ")}
            </strong>
            . Atualize a página em alguns segundos.
          </p>
        </div>
      ) : null}

      {allClear ? (
        <EmptyState fullyChecked={!hasFailures} />
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

function EmptyState({ fullyChecked }: { fullyChecked: boolean }) {
  return (
    <div className="b3-pegando-fogo-empty">
      <span aria-hidden className="b3-pegando-fogo-empty-icon">
        🤝
      </span>
      <p className="b3-pegando-fogo-empty-msg">
        {fullyChecked
          ? "Tudo em dia por aqui."
          : "Nenhum sinal nas categorias checadas."}
      </p>
      <p className="b3-pegando-fogo-empty-hint">
        {fullyChecked
          ? "Caixa fechado, fiados em dia, estoque ok e WhatsApp respondido. Bom trabalho."
          : "Algumas verificações falharam — reveja após atualizar a página."}
      </p>
    </div>
  );
}
