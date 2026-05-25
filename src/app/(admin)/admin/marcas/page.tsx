import { loadBrands } from "@/actions/brand";
import { BrandsManager } from "@/components/admin/brands-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function MarcasPage() {
  await requireSession();
  const brands = await loadBrands();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S11 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub` (handoff stub-pages.jsx:162 "Marcas"). Subtítulo
          mais informativo que o mock — explica o behavior de snapshot
          histórico que o handoff não conhecia. */}
      <div>
        <h1 className="b3-page-title">Marcas</h1>
        <p className="b3-page-sub">
          Cadastro reutilizável de marcas pra filtrar produtos e padronizar
          relatórios. Produtos antigos com marca em texto livre continuam
          funcionando (snapshot histórico preservado).
        </p>
      </div>

      <BrandsManager initialBrands={brands} />
    </div>
  );
}
