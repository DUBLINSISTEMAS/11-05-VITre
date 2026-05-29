/**
 * /admin/orcamentos/ficha/novo — criar ficha de orçamento de balcão
 * (2026-05-28).
 *
 * Form livre estilo "talão de papel" do joalheiro (ICP). Distinto do
 * orçamento itemizado vindo do PDV — texto livre em "discriminação",
 * sem ligação com catálogo, sem desconto de estoque. Imprime A4 com
 * assinaturas cliente/responsável.
 */
import { FileTextIcon } from "lucide-react";
import Link from "next/link";

import { QuoteSheetForm } from "@/components/admin/quote-sheet-form";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

export const dynamic = "force-dynamic";

const DEFAULT_NOTICE =
  "Não nos responsabilizamos por peças deixadas por mais de 90 dias.";

export default async function NovaFichaPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: nova ficha sem loja");
  }

  return (
    <div className="b3-main-card">
      <header className="border-line flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4">
        <div>
          <h1 className="b3-page-title flex items-center gap-2">
            <FileTextIcon
              className="text-mangos-yellow-hover h-5 w-5"
              aria-hidden
            />
            Nova ficha de orçamento
          </h1>
          <p className="text-ink-4 mt-0.5 text-[12.5px]">
            Preencha e imprima. Cliente assina manualmente após impressão.
          </p>
        </div>
        <Link
          href="/admin/orcamentos"
          className="text-ink-3 hover:text-ink-1 text-[12.5px]"
        >
          Voltar
        </Link>
      </header>

      <div className="p-4 sm:p-6">
        <QuoteSheetForm
          store={{
            name: store.name,
            document: store.document,
            whatsappDisplay: store.whatsappDisplay,
            logoUrl: store.logoUrl,
            addressCity: store.addressCity,
            addressState: store.addressState,
          }}
          defaultNotice={DEFAULT_NOTICE}
        />
      </div>
    </div>
  );
}
