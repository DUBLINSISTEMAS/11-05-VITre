import { redirect } from "next/navigation";

/**
 * PP1 Fase B (handoff 2026-05-25): rota legacy redireciona pro deep-link
 * do drawer global em modo "new". Antes renderizava o NewProductForm
 * full-page; agora o ProductFormDrawerListener abre o drawer vazio ao
 * ler ?edit=new da URL.
 */
export default function NovoProdutoPage() {
  redirect("/admin/produtos?edit=new");
}
