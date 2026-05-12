/**
 * Tokens canônicos de animação — Vitrê (Onda 6 do pacote master 2026-05-12).
 *
 * Use estas constantes ao criar novas animações pra manter consistência
 * com Dialog, Sheet e drawer de categorias. Valores derivados das libs
 * que já usamos (shadcn Dialog 200ms, shadcn Sheet 380/240ms decelerate).
 *
 * NUNCA invente duração nova. Se precisar de um caso especial, adicione
 * aqui e documente o motivo.
 *
 * Acessibilidade: globals.css zera tudo em `prefers-reduced-motion`.
 * Não precisa checar em cada componente — o media query global cobre.
 */

/** Durações em milissegundos. */
export const motionDuration = {
  /** Hover, opacidade, micro-feedback. */
  xs: 120,
  /** Padrão pra Dialog (fade + zoom). Founder pediu 200-250ms. */
  sm: 220,
  /** Modal de fechamento, Sheet de fechamento. */
  md: 240,
  /** Sheet de abertura — entrada um pouco mais lenta pra parecer premium. */
  lg: 380,
} as const;

/** Curvas de easing. */
export const motionEasing = {
  /** Saída — começa rápido, desacelera. Padrão Material/Apple. */
  out: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Entrada que volta — começa lento, acelera. */
  in: "cubic-bezier(0.4, 0, 1, 1)",
  /** Genérico shadcn — bom default. */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

/** Helpers pra construir strings de transition prontas. */
export const motionTransition = {
  fast: `${motionDuration.xs}ms ${motionEasing.standard}`,
  modal: `${motionDuration.sm}ms ${motionEasing.out}`,
  drawerIn: `${motionDuration.lg}ms ${motionEasing.out}`,
  drawerOut: `${motionDuration.md}ms ${motionEasing.in}`,
} as const;
