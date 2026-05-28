"use client";

// NewSaleButton — CTA "Nova venda" pro header de dashboards.
// Dispara o mesmo NEW_SALE_EVENT que F2 (atalho global desktop). Mobile
// não tem F2 — esse botão é a entrada principal pra abrir o modal de
// nova venda em qualquer tamanho de tela.

import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { NEW_SALE_EVENT } from "@/components/admin/pdv/new-sale-events";

function openNewSale() {
  window.dispatchEvent(new Event(NEW_SALE_EVENT));
}

// Prefetch silencioso do chunk do PdvShell ao primeiro hover/focus do CTA.
let _pdvPrefetched = false;
function prefetchPdvOnce() {
  if (_pdvPrefetched) return;
  _pdvPrefetched = true;
  void import("@/components/admin/pdv/pdv-shell");
}

export function NewSaleButton() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    );
  }, []);

  return (
    <button
      type="button"
      className="b3-newsale-cta"
      onClick={openNewSale}
      onMouseEnter={prefetchPdvOnce}
      onFocus={prefetchPdvOnce}
      aria-label="Nova venda (F2)"
      title={isMac ? "Nova venda (F2)" : "Nova venda (F2)"}
    >
      <PlusIcon size={15} aria-hidden />
      <span>Nova venda</span>
      <kbd className="b3-newsale-kbd" aria-hidden>
        F2
      </kbd>
    </button>
  );
}
