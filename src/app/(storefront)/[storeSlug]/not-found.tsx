/**
 * 404 do storefront.
 *
 * Disparado quando:
 *   - storeSlug não corresponde a nenhuma loja ativa (layout chama
 *     notFound());
 *   - rotas internas (categoria/produto inexistente) chamam notFound().
 *
 * Layout não tem como envelopar o not-found (é renderizado FORA do
 * layout do segmento), então a página é standalone — sem header/nav.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function StorefrontNotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-muted-foreground text-sm font-medium tracking-wide">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Loja ou página não encontrada
      </h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        A loja que você procura pode ter mudado de endereço ou o produto
        pode não estar mais disponível.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Ir para a página inicial</Link>
      </Button>
    </div>
  );
}
