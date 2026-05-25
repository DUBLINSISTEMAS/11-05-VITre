import { ReportStubPage } from "@/components/admin/report-stub";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function VendasCanalPage() {
  await requireSession();
  return (
    <ReportStubPage
      title="Vendas por canal"
      description="Compara performance entre Balcão (PDV) e Loja online (WhatsApp)."
      willMeasure={[
        "Volume de vendas por canal no período (count + R$)",
        "Ticket médio por canal",
        "Mix de produtos vendidos em cada canal (top 5)",
        "Conversão da loja online (visitas → carrinhos → vendas)",
        "Comparação A/B por dia da semana",
      ]}
    />
  );
}
