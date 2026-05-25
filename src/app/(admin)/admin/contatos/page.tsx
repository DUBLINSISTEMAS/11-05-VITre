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
        <h1 className="b3-page-title">Recados do site</h1>
        <p className="b3-page-sub">Loja não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S8 (handoff pixel-perfect 2026-05-25): vira `.b3-page-title` +
          `.b3-page-sub` (handoff stub-pages.jsx:102-103). Subtítulo do
          handoff é mais preciso pro escopo real do schema `lead` (form
          da vitrine + cliques no WhatsApp ainda não respondidos). */}
      <div>
        <h1 className="b3-page-title">Recados do site</h1>
        <p className="b3-page-sub">
          Mensagens recebidas pelo formulário da vitrine, ainda não
          respondidas pelo WhatsApp.
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
