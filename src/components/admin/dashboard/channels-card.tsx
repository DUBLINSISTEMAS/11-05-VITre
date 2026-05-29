/**
 * ChannelsCard — Distribuição de vendas por canal (Onda M5, 2026-05-29).
 *
 * Visual: card branco com header (título + total) + barra horizontal
 * segmentada (cada canal um bloco proporcional, cores Mangos) + legenda
 * abaixo com count + faturamento + % por canal.
 *
 * Vocabulário do balcão: "Balcão" e "WhatsApp" (não "Físico/Online" SaaS).
 * Quando 0 vendas no período: empty-state convidando uso do PDV.
 */

import { MessageCircleIcon, StoreIcon } from "lucide-react";

import type {
  LoadDashboardChannelsOutput,
  OrderChannel,
} from "@/actions/dashboard/load-channels";
import { formatBRL } from "@/lib/pricing";

interface ChannelsCardProps {
  data: LoadDashboardChannelsOutput;
  periodLabel: string;
}

const CHANNEL_META: Record<
  OrderChannel,
  { label: string; Icon: typeof StoreIcon; cssVar: string }
> = {
  balcao: {
    label: "Balcão",
    Icon: StoreIcon,
    cssVar: "var(--mangos-green-800)",
  },
  whatsapp: {
    label: "WhatsApp",
    Icon: MessageCircleIcon,
    cssVar: "var(--whatsapp)",
  },
};

const CHANNEL_ORDER: OrderChannel[] = ["balcao", "whatsapp"];

export function ChannelsCard({ data, periodLabel }: ChannelsCardProps) {
  const { slices, totalCount, totalRevenueInCents } = data;

  if (totalCount === 0) {
    return (
      <section className="b3-channels-card" aria-label="Vendas por canal">
        <header className="b3-channels-hd">
          <h2 className="b3-channels-title">Vendas por canal</h2>
          <span className="b3-channels-period">{periodLabel}</span>
        </header>
        <p className="b3-channels-empty">
          Sem vendas no período. Use o PDV pra registrar venda no balcão ou
          aguarde o cliente fechar pelo WhatsApp.
        </p>
      </section>
    );
  }

  const sorted = CHANNEL_ORDER.map((ch) =>
    slices.find((s) => s.channel === ch),
  ).filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <section className="b3-channels-card" aria-label="Vendas por canal">
      <header className="b3-channels-hd">
        <h2 className="b3-channels-title">Vendas por canal</h2>
        <span className="b3-channels-period">{periodLabel}</span>
      </header>

      <p className="b3-channels-total">
        <span className="b3-channels-total-num">{totalCount}</span>
        <span className="b3-channels-total-lbl">
          {totalCount === 1 ? "venda" : "vendas"}
        </span>
        <span className="b3-channels-total-sep" aria-hidden>
          ·
        </span>
        <span className="b3-channels-total-revenue">
          {formatBRL(totalRevenueInCents)}
        </span>
      </p>

      <div
        className="b3-channels-bar"
        role="img"
        aria-label={sorted
          .map(
            (s) =>
              `${CHANNEL_META[s.channel].label}: ${s.count} vendas, ${pct(s.count, totalCount)}%`,
          )
          .join(". ")}
      >
        {sorted.map((s) => {
          if (s.count === 0) return null;
          const meta = CHANNEL_META[s.channel];
          const widthPct = pct(s.count, totalCount);
          return (
            <span
              key={s.channel}
              className="b3-channels-seg"
              style={{
                width: `${widthPct}%`,
                background: meta.cssVar,
              }}
              title={`${meta.label}: ${s.count} de ${totalCount} (${widthPct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      <ul className="b3-channels-legend">
        {sorted.map((s) => {
          const meta = CHANNEL_META[s.channel];
          const Icon = meta.Icon;
          const sliceAvg =
            s.count > 0 ? Math.round(s.revenueInCents / s.count) : 0;
          return (
            <li key={s.channel} className="b3-channels-legend-row">
              <span
                aria-hidden
                className="b3-channels-legend-swatch"
                style={{ background: meta.cssVar }}
              />
              <span className="b3-channels-legend-icon">
                <Icon size={14} aria-hidden />
              </span>
              <span className="b3-channels-legend-label">{meta.label}</span>
              <span className="b3-channels-legend-count">
                {s.count} {s.count === 1 ? "venda" : "vendas"}
              </span>
              <span className="b3-channels-legend-pct">
                {pct(s.count, totalCount).toFixed(0)}%
              </span>
              <span className="b3-channels-legend-revenue">
                {formatBRL(s.revenueInCents)}
              </span>
              {s.count > 0 ? (
                <span className="b3-channels-legend-avg">
                  ticket {formatBRL(sliceAvg)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return (part / total) * 100;
}
