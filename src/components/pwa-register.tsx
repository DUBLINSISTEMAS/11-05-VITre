"use client";

/**
 * Registra o service worker `/sw.js` no client (Fase 6 / ADR-0017).
 *
 * - Só roda em produção (dev fica fora pra evitar cache de arquivos que
 *   você está editando — bug clássico de DX em PWA).
 * - Falha silenciosa: se browser não suportar SW (Firefox antigo, browsers
 *   sem suporte) ou se o registro falhar, app continua funcionando normal.
 */
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Silencioso — SW é progressive enhancement
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
