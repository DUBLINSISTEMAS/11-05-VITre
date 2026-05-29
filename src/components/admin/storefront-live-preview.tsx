"use client";

// Preview ao vivo da loja online — handoff Passo 13.
//
// Iframe apontando pra /{storeSlug} (rota pública, sem auth — funciona
// trivialmente no mesmo origin). Device toggle desktop/mobile redimensiona
// o iframe com transition suave. "Recarregar" força refresh sem F5 no admin.
// "Abrir em nova aba" leva pro storefront real fora do admin.
//
// O preview NÃO é live-binding com mudanças não-salvas — pra ver mudanças
// novas, lojista precisa Salvar primeiro (AppearanceForm faz isso) e clicar
// recarregar. Live diff seria 2x mais trabalho (draft store state + bind
// via channel API) e não é régua mínima pra "ver minha loja".

import { ExternalLinkIcon, MonitorIcon,RefreshCwIcon, SmartphoneIcon } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface StorefrontLivePreviewProps {
  storeSlug: string;
}

type Device = "desktop" | "mobile";

export function StorefrontLivePreview({ storeSlug }: StorefrontLivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<Device>("desktop");

  const reload = () => {
    // Replace recarrega o frame sem adicionar entrada ao histórico.
    const f = iframeRef.current;
    if (!f) return;
    const src = f.src;
    f.src = "about:blank";
    requestAnimationFrame(() => {
      f.src = src;
    });
  };

  return (
    <div className="b3-card overflow-hidden">
      <header className="border-line bg-bg-app flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            aria-pressed={device === "desktop"}
            aria-label="Visualizar como desktop"
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition",
              device === "desktop"
                ? "bg-surface text-mangos-green-800 shadow-sm"
                : "text-ink-4 hover:text-ink-2",
            )}
            title="Desktop"
          >
            <MonitorIcon size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            aria-pressed={device === "mobile"}
            aria-label="Visualizar como celular"
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition",
              device === "mobile"
                ? "bg-surface text-mangos-green-800 shadow-sm"
                : "text-ink-4 hover:text-ink-2",
            )}
            title="Celular"
          >
            <SmartphoneIcon size={14} aria-hidden />
          </button>
        </div>
        <p className="text-ink-4 truncate font-mono text-[11.5px]">
          vitre.site/{storeSlug}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reload}
            aria-label="Recarregar preview"
            className="text-ink-4 hover:text-ink-2 inline-flex size-7 items-center justify-center rounded-md transition"
            title="Recarregar"
          >
            <RefreshCwIcon size={14} aria-hidden />
          </button>
          <a
            href={`/${storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir loja em nova aba"
            className="text-ink-4 hover:text-ink-2 inline-flex size-7 items-center justify-center rounded-md transition"
            title="Abrir em nova aba"
          >
            <ExternalLinkIcon size={14} aria-hidden />
          </a>
        </div>
      </header>
      <div className="bg-bg-app flex justify-center overflow-hidden p-3">
        <div
          className="overflow-hidden rounded-[10px] border border-line bg-white shadow-sm transition-all duration-300"
          style={{
            width: device === "mobile" ? 375 : "100%",
            maxWidth: device === "mobile" ? 375 : 1280,
          }}
        >
          <iframe
            ref={iframeRef}
            src={`/${storeSlug}`}
            title={`Preview da loja ${storeSlug}`}
            className="block w-full"
            style={{
              height: device === "mobile" ? 700 : 720,
              border: 0,
            }}
            loading="lazy"
          />
        </div>
      </div>
      <footer className="border-line text-ink-4 border-t bg-bg-app px-3 py-2 text-[11.5px]">
        <strong className="text-ink-2 font-semibold">Pré-visualização</strong>{" "}
        — não atualiza ao vivo. Salve abaixo e clique em{" "}
        <RefreshCwIcon size={11} className="inline align-[-1px]" aria-hidden />{" "}
        recarregar pra ver as mudanças.
      </footer>
    </div>
  );
}
