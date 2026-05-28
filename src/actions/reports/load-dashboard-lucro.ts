"use server";

/**
 * loadDashboardLucro — Bloco F.2.1 da ressignificação (2026-05-28).
 *
 * Responde a pergunta-mãe #1 condensada pro dashboard:
 * "Você lucrou R$ X ontem · R$ Y essa semana".
 *
 * Estratégia: reusa `loadDreSimple` (já testado e em uso na tela
 * /admin/relatorios/resultado) com 4 ranges diferentes em paralelo:
 *   - yesterday (1 dia: ontem inteiro)
 *   - yesterdayLastWeek (1 dia: mesmo dia da semana, 7 dias atrás)
 *   - thisWeek (n dias: segunda-feira até agora)
 *   - previousWeekSame (n dias: segunda-feira 7d atrás até mesmo dia da semana anterior)
 *
 * Comparação HONESTA (princípio do paradigma):
 *   - "Ontem" compara com mesmo dia da semana (sex × sex, não sex × qui).
 *     Razão: padrão de venda do varejo BR varia muito por dia da semana —
 *     sábado vende 3× mais que terça. Comparar com ontem direto mente.
 *   - "Semana atual" compara com MESMA JANELA da semana anterior (se hoje
 *     é quinta, semana atual = seg-quinta; comparação = seg-quinta da
 *     semana passada). Razão: nunca comparar semana parcial com semana
 *     cheia anterior.
 *
 * Gate de honestidade: o `DreSimpleSummary` já reporta `cogsCoveragePercent`
 * (% de itens com custo cadastrado). Se cobertura < 80%, dashboard mostra
 * warning "X vendas sem custo no cálculo". Não estimamos custo faltante —
 * lojista vê número honesto e preenche cadastro.
 *
 * Performance: 4 chamadas SEQUENCIAIS dentro do mesmo `withTenant` causariam
 * 4× round-trip. Como cada `loadDreSimple` abre sua própria transação
 * (`withTenant`), usamos `Promise.all` no top-level — 4 transações paralelas
 * no mesmo pool. Custo: ~80ms total em prod (vs ~250ms sequencial).
 *
 * Edge case zero-day: loja que abriu hoje tem `yesterday` vazio. Helper
 * retorna summary com zeros — dashboard renderiza empty state honesto
 * em vez de "R$ 0,00 (-100%)".
 */

import { loadDreSimple } from "@/actions/reports/load-dre";
import type { DreSimpleSummary } from "@/actions/reports/types";

/**
 * Resultado por janela temporal: o DRE da janela ATUAL e da janela
 * de COMPARAÇÃO (mesmo período, deslocado 7 dias). `previous` pode
 * ser `null` quando o range histórico ainda não tem dados.
 */
export interface DashboardLucroWindow {
  current: DreSimpleSummary;
  previous: DreSimpleSummary | null;
  /** Label humano: "ontem" ou "esta semana". */
  scopeLabel: string;
  /** Label do range usado em comparação ("sex 21/05" ou "seg 19 a qui 22"). */
  compareLabel: string;
  /** Quantos dias o range cobre — usado pelo UI pra textos plurais. */
  dayCount: number;
}

export interface LoadDashboardLucroOutput {
  yesterday: DashboardLucroWindow;
  thisWeek: DashboardLucroWindow;
}

/**
 * Lê 4 ranges em paralelo e devolve estrutura prontas pro Hero.
 * NÃO consome args — escolha de "ontem + semana atual" é canônica.
 * Se loja precisar de outro recorte, ela usa `/admin/relatorios/resultado`.
 */
export async function loadDashboardLucro(): Promise<LoadDashboardLucroOutput | null> {
  const now = new Date();

  // ---- YESTERDAY ----
  // "Ontem" = de 00:00:00 até 23:59:59 do dia anterior (timezone do servidor).
  // `loadDreSimple` aplica `setHours(0,0,0,0)` e `setHours(23,59,59,999)`
  // no `resolveReportRange` quando recebe periodo=custom — então passamos
  // datas no formato YYYY-MM-DD e ele faz o resto.
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = isoDate(yesterday);

  const yesterdayLastWeek = new Date(yesterday);
  yesterdayLastWeek.setDate(yesterdayLastWeek.getDate() - 7);
  const yesterdayLastWeekISO = isoDate(yesterdayLastWeek);

  // ---- THIS WEEK (segunda-atual até hoje, inclusive) ----
  // Varejo BR usa "semana segunda-domingo". Hoje pode ser qualquer dia.
  // Se hoje é segunda, semana atual = só hoje (1 dia). Se domingo, 7 dias.
  const todayDow = now.getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const daysSinceMonday = (todayDow + 6) % 7; // seg=0, dom=6
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const weekStartISO = isoDate(weekStart);
  const todayISO = isoDate(now);

  // Semana anterior: MESMA quantidade de dias (daysSinceMonday + 1),
  // 7 dias atrás. Se hoje é quinta (4 dias decorridos), comparação
  // são os 4 primeiros dias da semana passada.
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(now);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
  const prevWeekStartISO = isoDate(prevWeekStart);
  const prevWeekEndISO = isoDate(prevWeekEnd);

  // ---- Fire 4 paralelos ----
  const [yToday, yPrev, wCurrent, wPrev] = await Promise.all([
    loadDreSimple({
      filters: { periodo: "custom", start: yesterdayISO, end: yesterdayISO },
    }),
    loadDreSimple({
      filters: {
        periodo: "custom",
        start: yesterdayLastWeekISO,
        end: yesterdayLastWeekISO,
      },
    }),
    loadDreSimple({
      filters: { periodo: "custom", start: weekStartISO, end: todayISO },
    }),
    loadDreSimple({
      filters: { periodo: "custom", start: prevWeekStartISO, end: prevWeekEndISO },
    }),
  ]);

  // Sem sessão / sem store: loadDreSimple devolve null. Dashboard renderiza
  // empty state.
  if (!yToday || !wCurrent) return null;

  const dayCountWeek = daysSinceMonday + 1; // seg=1, ter=2, ..., dom=7

  return {
    yesterday: {
      current: yToday.summary,
      previous: yPrev?.summary ?? null,
      scopeLabel: "ontem",
      compareLabel: formatShortBR(yesterdayLastWeek),
      dayCount: 1,
    },
    thisWeek: {
      current: wCurrent.summary,
      previous: wPrev?.summary ?? null,
      scopeLabel: "esta semana",
      compareLabel:
        dayCountWeek === 1
          ? formatShortBR(prevWeekStart)
          : `${formatShortBR(prevWeekStart)}–${formatShortBR(prevWeekEnd)}`,
      dayCount: dayCountWeek,
    },
  };
}

/** Formata data como YYYY-MM-DD (consumido por resolveReportRange). */
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DOW_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "qui 22/05" — combina dia da semana + DD/MM pra hint humano. */
function formatShortBR(d: Date): string {
  const dow = DOW_PT[d.getDay()] ?? "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dow} ${dd}/${mm}`;
}
