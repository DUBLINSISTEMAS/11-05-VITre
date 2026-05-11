/**
 * Helpers de formatação compartilhados pelo admin.
 */

/**
 * "agora", "há 5min", "há 3h", "há 2d" ou "07 mai" pra datas mais antigas.
 * Usado em listas onde a data exata cabe num tooltip mas a tipografia
 * principal precisa ser scannable.
 */
export function formatRelativeDate(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "agora";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/**
 * Stat delta para chips dos stat cards do dashboard admin (canvas-v1).
 *
 * - `kind: "percent"` → "+12,3%" / "−3,4%" / "0%"
 * - `kind: "absolute"` → "+12" / "−3" / "0" (ex: +3 pedidos)
 *
 * `tone` é o intent semântico pra cor do chip — `positive` usa success-soft,
 * `negative` usa destructive-soft, `neutral` usa muted. Sinal e tom são
 * decididos juntos pelo helper pra evitar inconsistência.
 */
export function formatStatDelta(
  value: number,
  kind: "percent" | "absolute" = "percent",
): { label: string; tone: "positive" | "negative" | "neutral" } {
  const tone: "positive" | "negative" | "neutral" =
    value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const number =
    kind === "percent"
      ? abs.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        })
      : abs.toLocaleString("pt-BR");
  const suffix = kind === "percent" ? "%" : "";
  return { label: `${sign}${number}${suffix}`, tone };
}
