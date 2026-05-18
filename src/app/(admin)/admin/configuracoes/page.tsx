import { TrashIcon } from "lucide-react";

import { BusinessHoursForm } from "@/components/admin/business-hours-form";
import { StoreConfigForm } from "@/components/admin/store-config-form";
import { WhatsAppTemplateCard } from "@/components/admin/whatsapp-template-card";
import type { BusinessHoursJson } from "@/db/schema/store";
import { requireSession } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { getCurrentStore } from "@/lib/store-context";

/**
 * Configurações — Onda A.15 pixel-perfect Dublin v3 (B3ConfiguracoesScreen
 * bagy-extra.jsx:648).
 *
 * Layout handoff: 2-col grid (form left + sidebar right com Plano + Zona de
 * perigo). Vitrê preserva StoreConfigForm + WhatsAppTemplateCard internos
 * (598 linhas total — sweep shadcn→b3 fica como follow-up se necessário).
 *
 * Right column:
 *  - Plano (placeholder até B.5 / Assinatura ADR-0023+) — soon
 *  - Zona de perigo: "Excluir loja" disabled (não implementado; founder
 *    decide quando expor)
 */
export default async function ConfiguracoesPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: configuracoes page sem loja");
  }

  const storefrontUrl = `${env.NEXT_PUBLIC_APP_URL}/${store.slug}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Configurações
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Identidade, contato e endereço da sua loja.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Coluna principal: forms */}
        <div className="space-y-4">
          <StoreConfigForm
            initialData={{
              name: store.name,
              description: store.description,
              niche: store.niche,
              whatsappNumber: store.whatsappDisplay,
              addressStreet: store.addressStreet,
              addressNumber: store.addressNumber,
              addressNeighborhood: store.addressNeighborhood,
              addressCity: store.addressCity,
              addressState: store.addressState,
              googleMapsUrl: store.googleMapsUrl,
              instagramHandle: store.instagramHandle,
            }}
            storefrontUrl={storefrontUrl}
          />

          <WhatsAppTemplateCard initialTemplate={store.whatsappTemplate} />

          <BusinessHoursForm
            initialHours={store.businessHours as BusinessHoursJson | null}
          />
        </div>

        {/* Coluna lateral: Plano + Zona de perigo */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PlanCard />
          <DangerZoneCard />
        </aside>
      </div>
    </div>
  );
}

function PlanCard() {
  return (
    <div className="b3-card b3-card-pad">
      <h3 className="text-ink-1 text-[16px] font-bold">Plano</h3>
      <p className="text-ink-3 mt-2 text-[13px] leading-relaxed">
        Você está no plano <b>Trial</b> · em desenvolvimento. Assinatura formal
        chega em breve com 3 níveis (Starter/Pro/Business).
      </p>
      <button
        type="button"
        disabled
        className="b3-btn b3-btn--cta mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        style={{ height: 40 }}
        title="Disponível em breve — Onda B.5 / Assinatura"
      >
        Assinar Pro · em breve
      </button>
    </div>
  );
}

function DangerZoneCard() {
  return (
    <div className="b3-card b3-card-pad">
      <h3
        className="text-[16px] font-bold"
        style={{ color: "var(--danger)" }}
      >
        Zona de perigo
      </h3>
      <p className="text-ink-3 mt-2 text-[13px] leading-relaxed">
        Ações irreversíveis · cuidado. Excluir loja remove TUDO: produtos,
        pedidos, clientes, imagens.
      </p>
      <button
        type="button"
        disabled
        className="b3-btn mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          color: "var(--danger)",
          borderColor: "rgba(185,28,28,0.2)",
          height: 36,
        }}
        title="Disponível em breve — fluxo de exclusão exige confirmação dupla + export de dados"
      >
        <TrashIcon size={13} /> Excluir loja · em breve
      </button>
    </div>
  );
}
