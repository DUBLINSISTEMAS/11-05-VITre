import { loadAttributes } from "@/actions/attribute/load";
import { AttributesManager } from "@/components/admin/attributes-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AtributosPage() {
  await requireSession();
  const attributes = await loadAttributes();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Filtros da loja
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Catálogo de cores, tamanhos e características reutilizáveis entre
          produtos.
        </p>
      </div>

      <AttributesManager initialAttributes={attributes} />
    </div>
  );
}
