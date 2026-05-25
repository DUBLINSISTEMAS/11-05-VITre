import { loadFullReport } from "@/actions/reports/load";
import { RelatoriosIndexCards } from "@/components/admin/relatorios-index-cards";
import { ReportView } from "@/components/admin/report-view";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const report = await loadFullReport(params);

  if (!report) {
    return (
      <div className="space-y-4">
        <h1 className="b3-page-title">Relatórios</h1>
        <p className="b3-page-sub">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* S15 (handoff pixel-perfect 2026-05-25): h1 + sub viram
          `.b3-page-title` + `.b3-page-sub` (handoff relatorios.jsx pattern).
          RelatoriosIndexCards renderiza a galeria de 8 cards abaixo;
          ReportView é o dashboard agregado que mantemos pra visão geral
          rápida. Passo 12. */}
      <div>
        <h1 className="b3-page-title">Relatórios</h1>
        <p className="b3-page-sub">
          Imprima A4 com logo da loja ou exporte CSV pra mandar pro contador.
        </p>
      </div>
      <RelatoriosIndexCards />
      <ReportView report={report} filters={params} />
    </div>
  );
}
