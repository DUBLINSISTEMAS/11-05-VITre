/**
 * Tradutores de erros do Postgres/Drizzle para mensagens amigáveis.
 *
 * Lojista (50+, pouca tech) nunca deve ver "duplicate key value violates unique
 * constraint product_store_slug_unique" — isso vira "Já existe um produto com
 * esse nome. Tente outro."
 */

/** Código SQLSTATE 23505 = unique_violation. */
export function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: string }).code;
  return code === "23505";
}

/**
 * Extrai o nome do constraint que falhou. Útil para mapear unique violation
 * de slug vs unique de outra coluna.
 */
export function getConstraintName(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  return (e as { constraint?: string }).constraint;
}
