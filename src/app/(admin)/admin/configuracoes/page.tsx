import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { StoreConfigForm } from "@/components/admin/store-config-form";
import { requireSession } from "@/lib/auth-server";
import { env } from "@/lib/env";
import { getCurrentStore } from "@/lib/store-context";

export default async function ConfiguracoesPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: configuracoes page sem loja");
  }

  const storefrontUrl = `${env.NEXT_PUBLIC_APP_URL}/${store.slug}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Configurações"
        subtitle="Identidade, contato e endereço da sua loja."
      />

      <StoreConfigForm
        initialData={{
          name: store.name,
          description: store.description,
          niche: store.niche,
          whatsappNumber: store.whatsappDisplay, // edita formato com máscara
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
    </div>
  );
}
