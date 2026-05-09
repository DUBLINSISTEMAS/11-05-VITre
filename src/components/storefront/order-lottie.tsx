"use client";

/**
 * Animação Lottie de "pedido enviado" — reusa public/lottie/order-approved.json
 * (importado na Fase 0). Loaded via dynamic import com ssr:false pra
 * não infl ar o bundle das outras páginas.
 *
 * Acessibilidade: respeita `prefers-reduced-motion` mostrando ícone
 * estático em vez da animação.
 */
import { CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export function OrderLottie() {
  const [animationData, setAnimationData] = useState<unknown | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    fetch("/lottie/order-approved.json")
      .then((res) => res.json())
      .then((data) => setAnimationData(data))
      .catch(() => {
        // Falha — cai no ícone estático.
        setAnimationData(null);
      });
  }, [reducedMotion]);

  if (reducedMotion || !animationData) {
    return (
      <div
        aria-hidden
        className="bg-success/10 mx-auto grid size-24 place-items-center rounded-full"
      >
        <CheckCircle2 className="text-success size-12" />
      </div>
    );
  }

  return (
    <div aria-hidden className="mx-auto h-32 w-32">
      <Lottie animationData={animationData} loop={false} />
    </div>
  );
}
