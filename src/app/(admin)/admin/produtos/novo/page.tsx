import { redirect } from "next/navigation";

import { createDraftProduct } from "@/actions/product/create-draft";

/**
 * Rota "Novo produto" — server component que cria draft e redireciona pra
 * `/admin/produtos/{id}/editar`.
 *
 * Por que server component em vez de form com botão? Porque o link `/novo`
 * vira o trigger de criação. Next 15 dedupa requisições de navegação
 * idempotentes — duplo-clique no botão "+ Novo produto" não gera 2 drafts
 * (em contraste com server action chamada de client, que precisaria de
 * `useTransition` + `disabled`).
 *
 * `redirect()` lança `NEXT_REDIRECT` — precisa estar FORA de qualquer
 * try/catch que engoliria a exception. Por isso checamos resultado e
 * fazemos redirect só no fluxo feliz, ou redirect pra erro no fluxo triste.
 */
export default async function NovoProdutoPage() {
  const result = await createDraftProduct();

  if (!result.ok) {
    // Sem rota de erro dedicada ainda — volta pra lista com a mensagem
    // como query string (a página de lista pode ler e mostrar toast).
    redirect(
      `/admin/produtos?erro=${encodeURIComponent(result.error)}`,
    );
  }

  redirect(`/admin/produtos/${result.productId}/editar`);
}
