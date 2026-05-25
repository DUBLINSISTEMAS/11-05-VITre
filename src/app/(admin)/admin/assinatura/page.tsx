import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Assinatura — rota DESATIVADA até Stripe + planos pagos estarem ativos.
 *
 * Sprint flash 2026-05-24 — régua "funciona ou esconde" (CLAUDE.md):
 * página era placeholder UI com 3 planos e CTAs "Em breve" desabilitados.
 * Lojista pagante clicando bate parede — promessa não-entregue corrói
 * confiança no produto inteiro.
 *
 * Item já saiu do menu da sidebar (nav-items.ts); agora bloqueamos por
 * URL também. Volta junto com o backend de assinatura (Fase 3 — Stripe).
 * O markup original (cards de plano Starter/Pro/Business + FAQ) está
 * preservado no git history — recuperar quando o checkout Stripe entrar.
 */
export default function AssinaturaPage() {
  notFound();
}
