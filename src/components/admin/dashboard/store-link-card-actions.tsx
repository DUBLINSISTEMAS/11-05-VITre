"use client";

/**
 * Ações client-side do StoreLinkCard: Copiar link e Ver QR.
 *
 * Server renderiza o SVG do QR (lib `qrcode`, zero JS extra no client) e
 * passa como string pra cá; o Dialog exibe via dangerouslySetInnerHTML.
 * O conteúdo já é SVG estático gerado por lib confiável — não há risco
 * de XSS (não vem de input do usuário).
 */
import { CheckIcon, CopyIcon, QrCodeIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface StoreLinkCardActionsProps {
  /** URL pública completa (`https://mangospay.app/{slug}`). */
  storeUrl: string;
  /** Nome da loja (cabeçalho do Dialog do QR). */
  storeName: string;
  /** SVG do QR code já renderizado server-side. */
  qrSvg: string;
}

export function StoreLinkCardActions({
  storeUrl,
  storeName,
  qrSvg,
}: StoreLinkCardActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success("Link copiado.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Não consegui copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        className="b3-btn b3-btn--sm inline-flex items-center gap-1.5"
        aria-label="Copiar link da loja"
      >
        {copied ? (
          <CheckIcon className="size-3.5" aria-hidden />
        ) : (
          <CopyIcon className="size-3.5" aria-hidden />
        )}
        {copied ? "Copiado" : "Copiar"}
      </button>

      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="b3-btn b3-btn--sm inline-flex items-center gap-1.5"
            aria-label="Ver QR Code da loja"
          >
            <QrCodeIcon className="size-3.5" aria-hidden />
            QR
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>QR Code da loja</DialogTitle>
            <DialogDescription>
              Cliente aponta a câmera e vai direto pra {storeName}. Imprima em
              cartão, etiqueta de produto ou vitrine.
            </DialogDescription>
          </DialogHeader>

          <div
            className="border-line mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-xl border bg-white p-4 [&_svg]:h-full [&_svg]:w-full"
            // SVG estático gerado server-side pela lib qrcode — não há
            // input de usuário no conteúdo, render seguro.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <p className="text-ink-4 break-all text-center font-mono text-[11px]">
            {storeUrl}
          </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleCopy}
              className="b3-btn b3-btn--sm inline-flex items-center gap-1.5"
            >
              {copied ? (
                <CheckIcon className="size-3.5" aria-hidden />
              ) : (
                <CopyIcon className="size-3.5" aria-hidden />
              )}
              {copied ? "Link copiado" : "Copiar link"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
