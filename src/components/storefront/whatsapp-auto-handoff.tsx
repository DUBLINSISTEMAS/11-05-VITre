"use client";

/**
 * Handoff automático pro WhatsApp pós-checkout — Onda 5 (2026-05-13).
 *
 * Renderizado em /sucesso quando o usuário acabou de criar o pedido
 * (checkout passa `?auto=1`). Comportamento:
 *   1. Mostra mensagem "Finalizando seu pedido no WhatsApp" com spinner.
 *   2. Após DELAY_MS, dispara `markWhatsAppOpened` (race com timeout
 *      pra não bloquear) e seta `window.location.href = whatsappUrl`.
 *   3. Link de escape sempre visível (caso o redirect falhe ou o
 *      usuário queira abrir manualmente antes do countdown acabar).
 *
 * Decisões:
 *  - 2.5s de delay — tempo suficiente pra o usuário ler "indo pro
 *    WhatsApp" e a confirmação visual aparecer; rápido o suficiente
 *    pra não irritar.
 *  - `window.location.href` em vez de `window.open` porque o segundo
 *    exige user gesture e silenciosamente falha em iOS Safari quando
 *    chamado de setTimeout.
 *  - Se a aba estiver inativa quando o timer disparar, abortamos o
 *    redirect automático e mostramos um CTA explícito "Abrir WhatsApp"
 *    quando o usuário voltar pra aba. Onda C #14 (auditoria 2026-05-19):
 *    antes mostrava `null` (componente sumia), confundia o usuário que
 *    voltava sem saber o que aconteceu.
 */
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import { markWhatsAppOpened } from "@/actions/order/mark-whatsapp-opened";

const DELAY_MS = 2500;
const ACTION_TIMEOUT_MS = 800;

export interface WhatsAppAutoHandoffProps {
  publicToken: string;
  whatsappUrl: string;
}

export function WhatsAppAutoHandoff({
  publicToken,
  whatsappUrl,
}: WhatsAppAutoHandoffProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(DELAY_MS / 1000));
  const [aborted, setAborted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const tick = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Tab inativa — usuário não está esperando o redirect. Aborta.
        setAborted(true);
        return;
      }
      // Race entre action e timeout: garante marca mesmo se a navegação
      // cancelar fetches in-flight.
      await Promise.race([
        markWhatsAppOpened({ publicToken }).catch(() => null),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), ACTION_TIMEOUT_MS),
        ),
      ]);
      if (cancelled) return;
      window.location.href = whatsappUrl;
    }, DELAY_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [publicToken, whatsappUrl]);

  // Fallback quando o redirect automático foi abortado (aba estava em
  // background). Mostra CTA explícito em vez de sumir.
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
        Finalizando seu pedido no WhatsApp
      </p>
      <p className="text-[12px] text-muted-foreground">
        Levando você em {secondsLeft}s…
      </p>
      <a
        href={whatsappUrl}
        className="text-[12px] font-medium text-whatsapp underline-offset-2 hover:underline"
      >
        Abrir agora →
      </a>
    </div>
  );
}
