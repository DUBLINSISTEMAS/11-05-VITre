import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import {
  listProductsForCollectionPicker,
  loadCollections,
} from "@/actions/storefront-collection";
import { CollectionsManager } from "@/components/admin/collections-manager";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

export const dynamic = "force-dynamic";

export default async function ColecoesPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: colecoes page sem loja");
  }

  const [collections, products] = await Promise.all([
    loadCollections(),
    listProductsForCollectionPicker(),
  ]);

  return (
    <div className="space-y-5">
      {/* S21 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub. Título "Vitrines" (handoff vitrines.jsx:54) em vez do
          mais longo "Vitrines da loja online". Sub usa texto exato do
          handoff. CTA "Ver na loja" no canto direito.

          GAP CONHECIDO (auto-rules): o handoff prevê 5 regras automáticas
          (on-sale/top-sold/category/brand/new) além do manual handpick.
          Nosso schema hoje é manual-only (storefront_collection_item join
          table — sem coluna `type` nem `rule` jsonb). Adicionar auto-rules
          exige migration nova + action resolver + UI rule editor + render
          server-side no storefront — escopo de slice dedicada S21b, fora
          desta. Por ora mantemos CollectionsManager 100% manual. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="b3-page-title">Vitrines</h1>
          <p className="b3-page-sub">
            Seções da home da loja online. Crie destaques, promoções e
            coleções personalizadas.
          </p>
        </div>
        <Link
          href={`/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="b3-btn b3-btn--sm"
          title="Abrir loja em nova aba"
        >
          <ExternalLinkIcon size={13} aria-hidden />
          Ver na loja
        </Link>
      </div>

      <CollectionsManager
        initialCollections={collections}
        availableProducts={products}
      />
    </div>
  );
}
