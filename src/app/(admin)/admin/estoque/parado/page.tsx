/**
 * /admin/estoque/parado — redirect pra tab consolidada (Onda L4).
 *
 * A rota antiga apontava pra "Estoque parado" standalone (S3.6 do Plano
 * de Endurecimento). Em L4 foi consolidada em /admin/estoque?view=parado.
 * Rota viva como redirect pra preservar links externos (PRs antigos,
 * bookmarks, comentarios no codigo).
 */
import { redirect } from "next/navigation";

export default function EstoqueParadoRedirect() {
  redirect("/admin/estoque?view=parado");
}
