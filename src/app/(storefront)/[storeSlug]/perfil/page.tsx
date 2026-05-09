/**
 * Página de perfil do storefront.
 *
 * Mostra informações sobre a loja e opções gerais.
 * Como não há sistema de autenticação para clientes,
 * exibe opções gerais como info da loja, contato, etc.
 */
import {
  ChevronRight,
  Heart,
  HelpCircle,
  Info,
  MapPin,
  Phone,
  ShoppingBag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getStoreBySlug } from "@/lib/storefront/store-loader";

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const addressLine = [
    [store.addressStreet, store.addressNumber].filter(Boolean).join(", "),
    store.addressNeighborhood,
    [store.addressCity, store.addressState].filter(Boolean).join(" / "),
  ]
    .filter(Boolean)
    .join(" — ");

  const menuItems = [
    {
      icon: ShoppingBag,
      label: "Meus Pedidos",
      description: "Acompanhe suas compras",
      href: `/${storeSlug}/pedidos`,
    },
    {
      icon: Heart,
      label: "Favoritos",
      description: "Produtos salvos",
      href: `/${storeSlug}/favoritos`,
    },
    {
      icon: MapPin,
      label: "Enderecos",
      description: "Gerenciar enderecos de entrega",
      href: `/${storeSlug}/enderecos`,
      disabled: true,
    },
    {
      icon: HelpCircle,
      label: "Ajuda",
      description: "Duvidas frequentes",
      href: `/${storeSlug}/ajuda`,
      disabled: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Store profile header */}
      <div className="flex flex-col items-center text-center">
        {store.logoUrl ? (
          <div className="mb-4 size-24 overflow-hidden rounded-full ring-4 ring-gray-100">
            <Image
              src={store.logoUrl}
              alt={store.name}
              width={96}
              height={96}
              priority
              className="size-full object-cover"
            />
          </div>
        ) : (
          <div className="mb-4 flex size-24 items-center justify-center rounded-full bg-foreground text-background ring-4 ring-gray-100">
            <span className="text-3xl font-bold">
              {store.name.charAt(0)}
            </span>
          </div>
        )}
        <h1 className="text-xl font-semibold text-foreground">{store.name}</h1>
        {store.description && (
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {store.description}
          </p>
        )}
      </div>

      {/* Menu options */}
      <div className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition-colors hover:bg-gray-100">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <Icon className="size-5 text-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </div>
          );

          if (item.disabled) {
            return (
              <div key={item.label} className="opacity-50 cursor-not-allowed">
                {content}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl"
            >
              {content}
            </Link>
          );
        })}
      </div>

      {/* Store info section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Sobre a Loja
        </h2>
        <div className="space-y-3">
          {store.whatsappDisplay && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="size-4 text-muted-foreground" />
              <a
                href={`https://wa.me/${store.whatsappNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                {store.whatsappDisplay}
              </a>
            </div>
          )}
          {addressLine && (
            <div className="flex items-start gap-3 text-sm">
              <MapPin className="size-4 text-muted-foreground mt-0.5" />
              <span className="text-foreground">{addressLine}</span>
            </div>
          )}
          {!store.whatsappDisplay && !addressLine && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Info className="size-4" />
              <span>Informacoes de contato nao disponiveis</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
