/**
 * /admin/financeiro/receber — redirect pra tela consolidada (Onda L2).
 *
 * A rota antiga apontava pra "A receber" standalone. Em L2 foi consolidada
 * com /pagar dentro de /admin/financeiro com tabs. Esta rota fica viva
 * como redirect server-side pra preservar links externos (PRs antigos,
 * bookmarks, mensagens no WhatsApp do time).
 */
import { redirect } from "next/navigation";

export default function AReceberRedirect() {
  redirect("/admin/financeiro?tab=receber");
}
