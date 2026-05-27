"use client";

/**
 * CTAs da página /sucesso — fiéis ao canvas (linhas 501-511 do
 * `_vitre-storefront.jsx`):
 *
 *  ┌───────────────────────────────────┐
 *  │ [💬] Voltar para o WhatsApp        │  bg-whatsapp h-[46]
 *  ├───────────────────────────────────┤
 *  │     Continuar comprando            │  outline h-[46]
 *  └───────────────────────────────────┘
 *
 * Botão WhatsApp dispara `markWhatsAppOpened` antes do redirect (race
 * vs timeout 800ms — copiado de `whatsapp-open-button.tsx` pra preservar
 * o markup canvas sem refatorar o componente compartilhado, que é usado
 * em outros lugares com estilo shadcn padrão).
 */
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { markWhatsAppOpened } from "@/actions/order/mark-whatsapp-opened";
import { logger } from "@/lib/logger";

const ACTION_TIMEOUT_MS = 800;

export interface SuccessCtasProps {
  publicToken: string;
  whatsappUrl: string;
  storeSlug: string;
}

export function SuccessCtas({ publicToken, whatsappUrl, storeSlug }: SuccessCtasProps) {
  const [isOpening, setIsOpening] = useState(false);

  async function handleOpen() {
    if (isOpening) return;
    setIsOpening(true);

    // Race entre action e timeout: garante que o "open" é registrado
    // mesmo quando window.location.href cancela fetches in-flight.
    await Promise.race([
      markWhatsAppOpened({ publicToken }).catch((err) => {
        logger.warn("storefront.whatsapp.mark_opened_failed", {
          err,
          publicToken,
        });
        return null;
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ACTION_TIMEOUT_MS)),
    ]);

    window.location.href = whatsappUrl;
  }

  return (
    <div className="mt-auto flex flex-col gap-2 pt-6">
      <button
        type="button"
        onClick={handleOpen}
        disabled={isOpening}
        className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] border-0 bg-whatsapp text-[13.5px] font-semibold text-white outline-none transition-colors hover:bg-whatsapp-hover focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
      >
        <MessageCircle className="size-4" aria-hidden strokeWidth={2} />
        {isOpening ? "Abrindo..." : "Continuar no WhatsApp"}
      </button>

      <Link
        href={`/${storeSlug}`}
        prefetch={false}
        className="inline-flex h-[46px] w-full items-center justify-center rounded-[12px] border border-border bg-background text-[13px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        Continuar comprando
      </Link>
    </div>
  );
}
