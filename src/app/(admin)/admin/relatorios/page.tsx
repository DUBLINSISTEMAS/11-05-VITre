import { RelatoriosIndexCards } from "@/components/admin/relatorios-index-cards";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

// Audit 2026-05-28: removido `<ReportView/>` desta página. Os dois loaders
// (`loadFullReport` e o `loadDreSimple` consumido em /admin/relatorios/resultado)
// se sobrepunham — clicar em "Resultado" no menu ativava DOIS dashboards de
// lucro líquido com nomes diferentes. O índice agora é só galeria de
// relatórios A4; quem quer visão consolidada vai em "Início" (dashboard) ou
// em "Resultado". Régua "funciona ou esconde" + princípio anti-redundância.
export default async function RelatoriosPage() {
  await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="b3-page-title">Relatórios</h1>
        <p className="b3-page-sub">
          Imprima A4 com logo da loja ou exporte CSV pra mandar pro contador.
        </p>
      </div>
      <RelatoriosIndexCards />
    </div>
  );
}
