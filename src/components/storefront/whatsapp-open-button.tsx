"use client";

/**
 * Botão "Abrir WhatsApp" que dispara `markWhatsAppOpened` antes do
 * redirect (analytics + state machine).
 *
 * Implementação: aguarda action OU 800ms (timeout fail-soft) — o que
 * vier primeiro. Sem isso, o `window.location.href` síncrono cancela
 * fetches in-flight e a action raramente chega ao server.
 *
 * Não bloqueia o cliente: 800ms é o teto absoluto. Se a action
 * resolver antes (caso comum), navega imediatamente. Se a action
 * pendurar, ainda navega depois de 800ms — cliente nunca trava.
 */
import { MessageCircle } from "lucide-react";
import { useState } from "react";

import { markWhatsAppOpened } from "@/actions/order/mark-whatsapp-opened";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

const ACTION_TIMEOUT_MS = 800;

export interface WhatsAppOpenButtonProps {
  publicToken: string;
  whatsappUrl: string;
  size?: "default" | "lg";
  variant?: "default" | "outline";
  className?: string;
  children?: React.ReactNode;
}

export function WhatsAppOpenButton({
  publicToken,
  whatsappUrl,
  size = "lg",
  variant = "default",
  className,
  children,
}: WhatsAppOpenButtonProps) {
  const [isOpening, setIsOpening] = useState(false);

  const handleClick = async () => {
    if (isOpening) return;
    setIsOpening(true);

    // Race entre a action e o timeout. Action sobrevive a fetch
    // cancelado se concluir antes de 800ms (caso comum no Vercel).
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
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      disabled={isOpening}
      className={cn("w-full", className)}
    >
      {children ?? (
        <>
          <MessageCircle className="size-5" aria-hidden />
          {isOpening ? "Abrindo..." : "Abrir WhatsApp"}
        </>
      )}
    </Button>
  );
}
