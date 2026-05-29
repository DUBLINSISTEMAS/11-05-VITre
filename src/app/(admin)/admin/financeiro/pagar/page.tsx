/**
 * /admin/financeiro/pagar — redirect pra tela consolidada (Onda L2).
 *
 * Mesma logica de receber/page.tsx — rota antiga preservada como redirect
 * pra nao quebrar links externos.
 */
import { redirect } from "next/navigation";

export default function APagarRedirect() {
  redirect("/admin/financeiro?tab=pagar");
}
