// Quick actions do dashboard — port Dublin v3 (ADR-0019, Onda A.5).
// Replica fielmente o b3-qa-grid 3-col do handoff `bagy-extra.jsx` linhas
// 40-55: "Visitar minha loja" (link external), "Minha central de ajuda"
// (mailto:), "Evoluir meu plano" (placeholder soon — rota /admin/assinatura
// ainda não existe; padrão `<button disabled>` seguindo A.3).
//
// Server component — sem state. Mobile responsivo via @media no
// `b3-qa-grid` em globals.css (2 cols <=1024px, 1 col <=640px).
import { InfoIcon, PaletteIcon, StarIcon } from "lucide-react";
import Link from "next/link";

export interface QuickActionsProps {
  storeSlug: string;
}

export function QuickActions({ storeSlug }: QuickActionsProps) {
  return (
    <section className="mb-7">
      <h2 className="mb-[14px] text-[16px] font-bold tracking-[-0.015em] text-ink-1">
        Acesso rápido
      </h2>
      <div className="b3-qa-grid">
        {/* 1. Visitar minha loja (storefront público) */}
        <Link
          href={`/${storeSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="b3-qa"
        >
          <PaletteIcon size={18} aria-hidden />
          <div className="b3-qa-title">Visitar minha loja</div>
          <span className="b3-qa-link">Acessar</span>
        </Link>

        {/* 2. Central de ajuda (mailto até existir página) */}
        <a href="mailto:contato@vitre.site" className="b3-qa">
          <InfoIcon size={18} aria-hidden />
          <div className="b3-qa-title">Minha central de ajuda</div>
          <span className="b3-qa-link">Acessar</span>
        </a>

        {/* 3. Evoluir plano (soon — rota /admin/assinatura não existe ainda) */}
        <button
          type="button"
          className="b3-qa b3-qa--cta cursor-not-allowed text-left opacity-95"
          title="Módulo de Assinatura chega em breve"
          disabled
        >
          <StarIcon size={18} aria-hidden />
          <div className="b3-qa-title">
            Evoluir
            <br />
            meu plano
          </div>
        </button>
      </div>
    </section>
  );
}
