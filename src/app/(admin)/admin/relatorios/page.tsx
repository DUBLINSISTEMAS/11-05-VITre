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
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Relatórios
        </h1>
        <p className="text-ink-3 text-[13px]">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* H1 + subtítulo bate o handoff. RelatoriosIndexCards renderiza
          a galeria de cards abaixo; ReportView é o dashboard agregado
          que mantemos pra visão geral rápida. Passo 12. */}
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Relatórios
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Imprima A4 com logo da loja ou exporte CSV pra mandar pro contador.
        </p>
      </div>
      <RelatoriosIndexCards />
      <ReportView report={report} filters={params} />
    </div>
  );
}
