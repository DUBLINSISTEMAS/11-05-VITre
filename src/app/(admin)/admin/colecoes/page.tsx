import {
  listProductsForCollectionPicker,
  loadCollections,
} from "@/actions/storefront-collection";
import { CollectionsManager } from "@/components/admin/collections-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ColecoesPage() {
  await requireSession();
  const [collections, products] = await Promise.all([
    loadCollections(),
    listProductsForCollectionPicker(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Vitrines da loja online
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Crie rotas e seções customizadas — &quot;Destaques&quot;, &quot;Promoções de maio&quot;,
          &quot;Lançamentos&quot; — e organize produtos curados em cada uma.
        </p>
      </div>

      <CollectionsManager
        initialCollections={collections}
        availableProducts={products}
      />
    </div>
  );
}
