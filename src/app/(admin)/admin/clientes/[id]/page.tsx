import { redirect } from "next/navigation";

/**
 * PP2 (handoff 2026-05-25): rota legacy redireciona pro deep-link do
 * drawer global. Antes esta página renderizava o EditCustomerForm
 * full-page; agora o CustomerFormDrawerListener (admin-shell) abre
 * o drawer ao ler ?customer=<id> da URL.
 */
interface EditClientePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditClientePage({ params }: EditClientePageProps) {
  const { id } = await params;
  redirect(`/admin/clientes?customer=${encodeURIComponent(id)}`);
}
