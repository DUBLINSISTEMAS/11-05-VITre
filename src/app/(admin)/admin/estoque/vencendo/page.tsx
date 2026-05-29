/**
 * /admin/estoque/vencendo — redirect pra tab consolidada (Onda L4).
 *
 * Mesma logica de parado/page.tsx — rota antiga preservada como redirect
 * pra nao quebrar links externos.
 */
import { redirect } from "next/navigation";

export default function EstoqueVencendoRedirect() {
  redirect("/admin/estoque?view=vencendo");
}
