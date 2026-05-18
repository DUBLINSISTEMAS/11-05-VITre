import { loadFullReport } from "@/actions/reports/load";
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

  return <ReportView report={report} filters={params} />;
}
