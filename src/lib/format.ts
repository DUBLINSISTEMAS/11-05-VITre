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
 * "07 mai 2026, 14:30" — formato completo p/ tooltip ou detalhe.
 */
export function formatFullDate(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
