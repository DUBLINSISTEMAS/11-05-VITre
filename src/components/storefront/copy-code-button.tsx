"use client";

/**
 * Botão de copiar/compartilhar código do pedido (shortCode) — usado no aviso
 * brand-tint da /sucesso. Onda 3 (2026-05-27): substitui o aviso passivo
 * por ação concreta. Onda 5 (2026-05-27): adiciona Web Share API quando
 * disponível (mobile moderno) — cliente compartilha código com outra pessoa
 * via menu nativo (Insta DM, mãe pelo WhatsApp, marido, etc).
 *
 * Decisão de ramo:
 *  - Mobile com `navigator.share` → preferimos share (mais flexível).
 *  - Desktop / iframe sem share → caímos pra Clipboard API.
 *  - Sem clipboard (contexto não-secure, raríssimo) → execCommand legacy.
 *
 * Label do botão muda dinamicamente pra refletir a ação real: "Compartilhar"
 * quando share API existe, "Copiar" quando só clipboard. Cliente não recebe
 * promessa que o sistema não pode entregar.
 */
import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export interface CopyCodeButtonProps {
  code: string;
  className?: string;
}

export function CopyCodeButton({ code, className }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  // Detecta share API após hidratação. SSR sempre mostra "Copiar"
  // (fallback seguro). Cliente atualiza pra "Compartilhar" se suportado.
  const [hasShare, setHasShare] = useState(false);
  useEffect(() => {
    setHasShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  async function fallbackCopy(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback execCommand pra contexto não-secure (dev local sem TLS).
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  async function handleClick() {
    const text = `#${code}`;
    const shareText = `Código do pedido: #${code}`;

    if (hasShare) {
      try {
        await navigator.share({ text: shareText });
        // Sucesso silencioso (usuário viu a sheet nativa). Sem toast pra
        // não duplicar feedback.
        return;
      } catch (err) {
        // AbortError = usuário cancelou. Ignora silenciosamente.
        if (err instanceof Error && err.name === "AbortError") return;
        // Erro real → cai pro copy.
      }
    }

    const ok = await fallbackCopy(text);
    if (ok) {
      setCopied(true);
      toast.success("Código copiado", { description: text });
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Não foi possível copiar — copie manualmente", {
        description: text,
      });
    }
  }

  const label = copied ? "Copiado" : hasShare ? "Compartilhar" : "Copiar";
  const Icon = copied ? CheckIcon : hasShare ? Share2Icon : CopyIcon;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        hasShare
          ? `Compartilhar código do pedido ${code}`
          : `Copiar código do pedido ${code}`
      }
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11.5px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", copied && "text-success")}
        strokeWidth={copied ? 2.2 : 1.8}
        aria-hidden
      />
      <span>{label}</span>
    </button>
  );
}
