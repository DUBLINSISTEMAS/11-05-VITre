"use client";

// Prefetcher do chunk do PdvShell — handoff founder 2026-05-26.
//
// O `<NewSaleModalListener />` (montado globalmente em admin-shell) carrega
// o PdvShell via `next/dynamic` com `ssr:false`. Vantagem: o chunk de 2200+
// linhas não pesa no initial bundle de rotas que NÃO vão vender (relatórios,
// cadastros, configurações). Desvantagem: a primeira "Nova venda" do dia
// espera o chunk baixar/parsear — 1-3s em conexão de cidade do interior.
//
// Este componente resolve o tradeoff: monta nas rotas onde a venda É o
// caminho principal (`/admin/pedidos` hoje; `/admin/pdv` também)+ dispara
// o `import()` em `useEffect`. O resultado é cached no browser; quando o
// lojista clica "Nova venda" minutos depois, o modal abre instantâneo.
//
// Zero render — retorna null. Idempotente — chamar várias vezes na mesma
// sessão custa nada (Webpack/Turbopack cacheiam o módulo).
import { useEffect } from "react";

export function PdvPrefetcher() {
  useEffect(() => {
    void import("@/components/admin/pdv/pdv-shell");
  }, []);
  return null;
}
