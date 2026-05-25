import { ReportStubPage } from "@/components/admin/report-stub";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ComprasFornecedorPage() {
  await requireSession();
  return (
    <ReportStubPage
      title="Compras por fornecedor"
      description="CMV detalhado: quanto saiu pra cada fornecedor no período."
      willMeasure={[
        "Total comprado por fornecedor (R$ e quantidade de NFs)",
        "Custo médio por produto comprado",
        "% de participação de cada fornecedor no CMV",
        "Prazos médios de pagamento (quando 'a pagar' for implementado)",
        "Histórico de compras pelo mesmo fornecedor",
      ]}
    />
  );
}
