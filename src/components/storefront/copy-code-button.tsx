"use client";

/**
 * Botão de copiar código do pedido (shortCode) — usado no aviso brand-tint
 * da /sucesso. Onda 3 (2026-05-27): substitui o aviso passivo "Salve seu
 * código" por ação concreta. Cliente leigo não precisa fazer nota mental
 * nem decorar/screenshot.
 *
 * Usa Clipboard API moderna. Quando indisponível (HTTP em prod errado,
 * iframe sem permissão), faz fallback silencioso pra select+execCommand
 * dentro de input efêmero. Toast Sonner dá feedback visual.
 */
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export interface CopyCodeButtonProps {
  code: string;
  className?: string;
}

export function CopyCodeButton({ code, className }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const text = `#${code}`;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        // Fallback: textarea efêmero + execCommand. Funciona em
        // contexto não-secure (raro mas existe em dev local sem TLS).
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch {
      ok = false;
    }

    if (ok) {
      setCopied(true);
      toast.success("Código copiado", {
        description: text,
      });
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Não foi possível copiar — copie manualmente", {
        description: text,
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copiar código do pedido ${code}`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[11.5px] font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5 text-success" strokeWidth={2.2} aria-hidden />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5" strokeWidth={1.8} aria-hidden />
          <span>Copiar</span>
        </>
      )}
    </button>
  );
}
