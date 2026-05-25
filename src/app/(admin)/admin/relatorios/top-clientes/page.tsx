import { ReportStubPage } from "@/components/admin/report-stub";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function TopClientesPage() {
  await requireSession();
  return (
    <ReportStubPage
      title="Top clientes"
      description="Ranking dos clientes que mais geraram receita no período."
      willMeasure={[
        "Top 20 clientes por R$ total no período",
        "Frequência de compra (vendas por cliente / mês)",
        "Ticket médio individual",
        "Última compra (dias desde a venda mais recente)",
        "Fiado em aberto por cliente (cruza com receivable)",
      ]}
    />
  );
}
