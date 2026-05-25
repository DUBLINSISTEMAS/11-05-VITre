import { redirect } from "next/navigation";

/**
 * PP1 Fase B (handoff 2026-05-25): rota legacy redireciona pro deep-link
 * do drawer global. Antes esta página renderizava o ProductForm full-page;
 * agora o ProductFormDrawerListener (montado em admin-shell) abre o
 * drawer ao ler ?edit=<id> da URL.
 *
 * Preserva bookmarks, links externos e URLs antigos sem 404.
 */
interface EditProdutoPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProdutoPage({ params }: EditProdutoPageProps) {
  const { id } = await params;
  redirect(`/admin/produtos?edit=${encodeURIComponent(id)}`);
}
