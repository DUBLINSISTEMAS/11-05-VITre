/**
 * Página /sobre — informações da LOJA (não do cliente).
 *
 * ADR-0008 deixa claro: cliente final não tem perfil, conta, favoritos.
 * Esta rota substitui o "/perfil" que apareceria em e-commerce com
 * conta de cliente. Aqui mostra: descrição, contato, endereço, Maps,
 * Instagram.
 */
import {
  Building2,
  Instagram,
  MapPin,
  MessageCircle,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getStoreBySlug } from "@/lib/storefront/store-loader";

interface PageParams {
  storeSlug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return { title: "Não encontrado" };
  return {
    title: "Sobre",
    description: `Conheça a ${store.name}. Endereço, contato e redes sociais.`,
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const addressLine = [
    store.addressStreet,
    store.addressNumber,
    store.addressNeighborhood,
  ]
    .filter(Boolean)
    .join(", ");
  const cityLine = [store.addressCity, store.addressState]
    .filter(Boolean)
    .join(" / ");
  const fullAddress = [addressLine, cityLine].filter(Boolean).join(" — ");
  const waNumber = store.whatsappNumber.replace(/\D/g, "");
  const igHandle = store.instagramHandle?.replace(/^@/, "");

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          Sobre a {store.name}
        </h1>
        {store.description ? (
          <p className="text-muted-foreground text-base leading-relaxed">
            {store.description}
          </p>
        ) : (
          <p className="text-muted-foreground/70 text-base italic">
            Conheça nossos produtos navegando pela vitrine.
          </p>
        )}
      </header>

      <section className="space-y-4">
        <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
          <Building2 className="size-5" aria-hidden />
          Contato
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              WhatsApp
            </p>
            <Button asChild variant="outline" className="mt-1">
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" aria-hidden />
                {store.whatsappDisplay}
              </a>
            </Button>
          </div>

          {igHandle && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Instagram
              </p>
              <Button asChild variant="outline" className="mt-1">
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="size-4" aria-hidden />@{igHandle}
                </a>
              </Button>
            </div>
          )}
        </div>
      </section>

      {fullAddress && (
        <section className="space-y-4">
          <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <MapPin className="size-5" aria-hidden />
            Endereço
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {fullAddress}
          </p>
          {store.googleMapsUrl && (
            <Button asChild variant="outline" size="sm">
              <a
                href={store.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver no Google Maps
              </a>
            </Button>
          )}
        </section>
      )}
    </article>
  );
}
