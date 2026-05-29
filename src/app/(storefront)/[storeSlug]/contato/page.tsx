/**
 * Página /[storeSlug]/contato — Sprint 5.2 (2026-05-22).
 *
 * Formulário público de contato (recado). Grava na tabela `lead` com
 * source='contact_form'. Painel admin removido em Onda L1 (2026-05-29) —
 * dados ficam preservados na tabela mas nao ha UI admin que consuma.
 * Anti-spoofing: storeSlug resolvido server-side via getStoreBySlug.
 */
import { Building2, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactForm } from "@/components/storefront/contact-form";
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
    title: "Fale conosco",
    description: `Envie um recado para a ${store.name}.`,
  };
}

export default async function ContatoPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { storeSlug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) notFound();

  const waNumber = store.whatsappNumber.replace(/\D/g, "");

  return (
    <article className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          Fale conosco
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Manda uma mensagem pra {store.name}. A gente lê e responde pelo
          WhatsApp.
        </p>
      </header>

      <ContactForm storeSlug={store.slug} storeName={store.name} />

      <section className="border-border rounded-xl border border-dashed p-4">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4" aria-hidden />
          Outros canais
        </h2>
        <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">
          Quer falar agora? Chama no WhatsApp:
        </p>
        <a
          href={`https://wa.me/${waNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground mt-2 inline-flex items-center gap-2 text-sm font-medium underline-offset-2 hover:underline"
        >
          <MessageCircle className="size-4" aria-hidden />
          {store.whatsappDisplay}
        </a>
      </section>
    </article>
  );
}
