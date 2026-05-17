"use client";

// Banner de trial no topo do admin — port Dublin v3 (ADR-0019, Onda A.3).
// Renderiza a faixa gradient navy (44px) com mensagem + CTA + close.
// Por enquanto HARDCODED ("14 dias restantes") porque Vitrê ainda não tem
// módulo de Assinatura (B.6 do plano). Quando entrar, esta peça vira
// data-driven (lê store.trialEndsAt / subscription.status).
//
// Estado de "fechado" persiste em sessionStorage pra não reaparecer durante
// a sessão atual; reaparece ao logar de novo (esperado pra trial).
import { SparklesIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "vitre.banner-trial.dismissed";

export function BannerTrial() {
  // Render-server safe: começa visível, esconde no useEffect se já fechado
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, "1");
    }
    setVisible(false);
  };

  return (
    <div className="b3-banner" data-admin-chrome="banner-trial" role="status">
      <span className="b3-banner-ico" aria-hidden>
        <SparklesIcon size={13} />
      </span>
      <span>
        Você está no <b>período de teste</b>. 14 dias restantes — aproveite
        pra explorar todos os módulos.
      </span>
      <button
        type="button"
        className="b3-banner-cta cursor-not-allowed opacity-80"
        title="Módulo de Assinatura chega em breve"
        disabled
      >
        Ver planos
      </button>
      <button
        type="button"
        className="b3-banner-x"
        onClick={handleDismiss}
        aria-label="Fechar banner"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
