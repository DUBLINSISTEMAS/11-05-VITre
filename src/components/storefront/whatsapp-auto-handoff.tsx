"use client";

/**
 * Handoff automático pro WhatsApp pós-checkout.
 *
 * Renderizado em /sucesso quando o usuário acabou de criar o pedido
 * (checkout passa `?auto=1`). Comportamento (atualizado 2026-05-26):
 *
 *   1. **Redirect imediato** ao mount. Sem countdown, sem delay.
 *      Antes (Onda 5/2026-05-13) havia delay de 2.5s + countdown
 *      visível ("Levando você em 3s…"). Risco real: cliente lia
 *      "pedido finalizado" e fechava a tela antes do redirect,
 *      perdendo o handoff (e o pedido virava abandono em 30min).
 *   2. `markWhatsAppOpened` em fire-and-forget (não bloqueia o redirect).
 *      A action grava no DB que o cliente passou pelo handoff —
 *      analítica defensiva, não pode atrasar a navegação.
 *   3. Se a aba está inativa no momento do mount, NÃO redireciona
 *      automaticamente (Safari iOS silenciosamente falha em
 *      `window.location.href` chamado de aba background). Mostra CTA
 *      explícito "Abrir WhatsApp" pra quando o usuário voltar.
 *   4. Link "Abrir agora" sempre visível durante o spinner — escape
 *      manual caso o redirect demore por qualquer razão (extensão,
 *      rede lenta).
 */
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { markWhatsAppOpened } from "@/actions/order/mark-whatsapp-opened";
import { logger } from "@/lib/logger";

export interface WhatsAppAutoHandoffProps {
  publicToken: string;
  whatsappUrl: string;
}

export function WhatsAppAutoHandoff({
  publicToken,
  whatsappUrl,
}: WhatsAppAutoHandoffProps) {
  const [aborted, setAborted] = useState(false);

  useEffect(() => {
    // Aba background → Safari iOS pode silenciar window.location.href.
    // Mostra fallback CTA explícito.
    if (typeof document !== "undefined" && document.hidden) {
      setAborted(true);
      return;
    }

    // Fire-and-forget — não atrasa o redirect. Erros logam mas não
    // bloqueiam.
    void markWhatsAppOpened({ publicToken }).catch((err) => {
      logger.warn("storefront.whatsapp.auto_mark_opened_failed", {
        err,
        publicToken,
      });
    });

    // Redirect imediato. Microtask (próximo tick) garante que o
    // browser pinte o spinner antes da navegação iniciar — evita
    // "tela branca" instantânea que parece bug.
    queueMicrotask(() => {
      window.location.href = whatsappUrl;
    });
  }, [publicToken, whatsappUrl]);

  if (aborted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-whatsapp/20 bg-whatsapp/5 px-5 py-6 text-center"
      >
        <p className="text-[15px] font-semibold tracking-tight text-foreground">
          Pedido pronto — clique para abrir o WhatsApp
        </p>
        <p className="text-[12px] text-muted-foreground">
          O envio automático pausou porque você estava em outra aba.
        </p>
        <a
          href={whatsappUrl}
          className="rounded-full bg-whatsapp px-5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
          style={{ touchAction: "manipulation" }}
        >
          Abrir WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-whatsapp/20 bg-whatsapp/5 px-5 py-6 text-center"
    >
      <Loader2Icon
        className="size-7 animate-spin text-whatsapp"
        aria-hidden
        strokeWidth={2}
      />
      <p className="text-[15px] font-semibold tracking-tight text-foreground">
        Abrindo o WhatsApp…
      </p>
      <a
        href={whatsappUrl}
        className="text-[12px] font-medium text-whatsapp underline-offset-2 hover:underline"
        style={{ touchAction: "manipulation" }}
      >
        Não abriu? Toque aqui →
      </a>
    </div>
  );
}
