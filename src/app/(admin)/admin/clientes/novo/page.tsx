import { redirect } from "next/navigation";

/**
 * PP2 (handoff 2026-05-25): rota legacy redireciona pro deep-link do
 * drawer global em modo "new". Antes renderizava o NewCustomerForm
 * full-page; agora abre o drawer vazio via ?customer=new.
 */
export default function NovoClientePage() {
  redirect("/admin/clientes?customer=new");
}
