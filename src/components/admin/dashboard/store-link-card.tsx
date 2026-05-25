/**
 * Card de destaque do link público da loja, ancorado no topo do /admin.
 *
 * Por quê: lojista entra no admin e precisa ver/copiar o link da própria
 * loja em ≤1 clique pra compartilhar no WhatsApp, bio do Insta, cartão
 * de visita. Conteúdo equivalente existia só em pós-signup (criar-loja/
 * bem-vindo) — aqui virou destaque permanente do dashboard.
 *
 * Server Component: gera o SVG do QR via lib `qrcode` em build/render time
 * (zero JS no client). As ações (copiar, abrir modal do QR) ficam num
 * client component irmão (`StoreLinkCardActions`) que recebe o SVG como
 * string.
 */
import { ExternalLinkIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";

import { env } from "@/lib/env";

import { StoreLinkCardActions } from "./store-link-card-actions";

export interface StoreLinkCardProps {
  storeSlug: string;
  storeName: string;
}

function buildStoreUrl(slug: string): { full: string; display: string } {
  // env.NEXT_PUBLIC_APP_URL já validado por Zod no boot — sempre URL completa.
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const full = `${base}/${slug}`;
  const display = base.replace(/^https?:\/\//, "").replace(/^www\./, "") + `/${slug}`;
  return { full, display };
}

async function renderQrSvg(url: string): Promise<string> {
  // SVG inline (não data URL) — vai direto no DOM via dangerouslySetInnerHTML
  // dentro do client (input estático gerado por lib confiável, sem XSS).
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}

export async function StoreLinkCard({ storeSlug, storeName }: StoreLinkCardProps) {
  const { full, display } = buildStoreUrl(storeSlug);
  const qrSvg = await renderQrSvg(full);

  return (
    <section
      aria-label="Link da sua loja"
      className="b3-card b3-card-pad flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--brand-wash)", color: "var(--brand)" }}
          aria-hidden
        >
          <StoreIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-ink-4 text-[11px] font-semibold uppercase tracking-[0.06em]">
            Link da sua loja
          </p>
          <p className="text-ink-1 mt-0.5 truncate font-mono text-[13.5px] font-semibold">
            {display}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StoreLinkCardActions
          storeUrl={full}
          storeName={storeName}
          qrSvg={qrSvg}
        />
        <Link
          href={`/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className="b3-btn b3-btn--sm inline-flex items-center gap-1.5"
          aria-label="Abrir loja online em uma nova aba"
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden />
          Abrir loja
        </Link>
      </div>
    </section>
  );
}
