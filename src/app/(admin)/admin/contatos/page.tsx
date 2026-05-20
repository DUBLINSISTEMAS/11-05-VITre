import { loadLeads } from "@/actions/lead/load";
import { LeadsList } from "@/components/admin/leads-list";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ContatosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const data = await loadLeads(params);

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Recados do site
        </h1>
        <p className="text-ink-3 text-[13px]">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Recados do site
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Toda intenção de compra via WhatsApp aparece aqui.
        </p>
      </div>

      <LeadsList
        rows={data.rows}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        stats={data.stats}
        filters={params}
      />
    </div>
  );
}
