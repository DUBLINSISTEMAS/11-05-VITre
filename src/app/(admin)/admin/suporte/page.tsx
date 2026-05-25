import {
  BookOpenIcon,
  HelpCircleIcon,
  MailIcon,
  PlayCircleIcon,
} from "lucide-react";

import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = "suporte@mangospay.app";

/**
 * Suporte — canal de ajuda do lojista.
 *
 * Sprint flash 2026-05-24 — régua "funciona ou esconde":
 * (1) telefone PESSOAL do founder (`5599981757512`) que estava hardcoded
 *     foi REMOVIDO. Com 50 lojistas, founder vira call-center 24h —
 *     escalabilidade comercial zero. Trocado por email genérico
 *     `suporte@mangospay.app`.
 * (2) Email genérico precisa estar plugado em uma caixa que alguém lê.
 *     Configurar forward → Anderson hoje, equipe depois.
 * (3) Card "WhatsApp" foi removido até existir um número Business
 *     dedicado (não-pessoal). Quando esse canal entrar, descomenta
 *     o ChannelCard de WhatsApp.
 */
export default async function SuportePage() {
  await requireSession();

  const emailUrl = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Suporte Mangos Pay")}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S25 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub (handoff stub-pages.jsx:177 "Suporte"). */}
      <div>
        <h1 className="b3-page-title">Suporte</h1>
        <p className="b3-page-sub">
          Canais de ajuda · documentação · primeiros passos.
        </p>
      </div>

      {/* Canais primários. WhatsApp Business em ativação — só email por agora. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChannelCard
          icon={MailIcon}
          title="Email"
          subtitle={SUPPORT_EMAIL}
          ctaLabel="Enviar email"
          href={emailUrl}
        />
        <div className="b3-card b3-card-pad flex items-start gap-3 opacity-70">
          <div
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{
              background: "var(--bg-app)",
              color: "var(--ink-4)",
            }}
          >
            <MailIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-ink-1 text-[14px] font-semibold">
              WhatsApp do suporte
            </div>
            <div className="text-ink-3 mt-0.5 text-[12.5px]">
              Em ativação. Por enquanto use email — respondemos em até 1 dia
              útil.
            </div>
          </div>
        </div>
      </div>

      {/* Quick tour */}
      <div className="b3-card b3-card-pad">
        <h3 className="text-ink-1 text-[16px] font-bold">Primeiros passos</h3>
        <p className="text-ink-3 mt-1 text-[12.5px]">
          Tour rápido do que dá pra fazer em cada parte do painel.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TourCard
            step="1"
            title="Cadastre seus produtos"
            description="Comece em /admin/produtos. Cada produto pode ter fotos, preço promo, variantes e filtros de loja."
          />
          <TourCard
            step="2"
            title="Configure sua loja online"
            description="Em /admin/aparencia, escolha cor da marca e modelo da loja. Em /admin/banners, suba destaques."
          />
          <TourCard
            step="3"
            title="Compartilhe seu link"
            description={`Seu link público fica em mangospay.app/<sua-loja>. Compartilhe no Instagram, Stories, link na bio.`}
          />
          <TourCard
            step="4"
            title="Receba vendas pelo WhatsApp"
            description="Cliente fecha carrinho → escolhe pagamento → abre WhatsApp com tudo preenchido."
          />
          <TourCard
            step="5"
            title="Use o PDV no balcão"
            description="Em /admin/pdv, registre vendas físicas. Abra o caixa antes, feche no fim do dia."
          />
          <TourCard
            step="6"
            title="Acompanhe os relatórios"
            description="Em /admin/relatorios, veja vendas, top produtos, clientes e recados do período."
          />
        </div>
      </div>

      {/* FAQ links */}
      <div className="b3-card b3-card-pad">
        <h3 className="text-ink-1 text-[16px] font-bold">Perguntas frequentes</h3>
        <ul className="mt-3 space-y-2 text-[13px]">
          {FAQ_ITEMS.map((item, i) => (
            <li key={i} className="text-ink-2 flex items-start gap-2">
              <HelpCircleIcon
                size={14}
                style={{ color: "var(--ink-4)", marginTop: 2, flexShrink: 0 }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recursos em breve */}
      <div className="b3-card b3-card-pad">
        <div className="flex items-start gap-3">
          <PlayCircleIcon size={18} style={{ color: "var(--ink-4)" }} />
          <div>
            <h3 className="text-ink-1 text-[14px] font-bold">
              Videoaulas · em breve
            </h3>
            <p className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">
              Tutoriais curtos cobrindo cada fluxo (produto, PDV, caixa,
              relatório). Sai com o lançamento da assinatura.
            </p>
          </div>
        </div>
      </div>

      {/* Base de conhecimento */}
      <div className="b3-card b3-card-pad">
        <div className="flex items-start gap-3">
          <BookOpenIcon size={18} style={{ color: "var(--ink-4)" }} />
          <div>
            <h3 className="text-ink-1 text-[14px] font-bold">
              Base de conhecimento · em breve
            </h3>
            <p className="text-ink-3 mt-1 text-[12.5px] leading-relaxed">
              Artigos detalhados sobre cada feature. Por enquanto, fale com a
              gente via WhatsApp ou email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const FAQ_ITEMS = [
  "Como meus clientes finalizam compras? Pelo WhatsApp — Mangos Pay não processa pagamento.",
  "Posso integrar com SEFAZ/NFe? Ainda não. Foco hoje é gestão simples sem fiscal.",
  "Como faço backup dos meus dados? Os dados ficam em prod permanente; export em CSV em /admin/relatorios.",
  "Funciona no celular? Sim. O painel todo é mobile-first. PDV também.",
  "Posso ter mais de uma loja? Hoje 1 conta = 1 loja. Multi-loja vem com o plano Business.",
  "Tem app pra instalar? Funciona como PWA: abre no navegador, instala como app no celular (Adicionar à tela inicial).",
];

function ChannelCard({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  href,
  target,
  tone,
}: {
  icon: typeof MailIcon;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  target?: string;
  tone?: "ok";
}) {
  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      className="b3-card b3-card-pad hocus:border-brand flex items-start gap-3 transition-colors"
    >
      <div
        className="grid h-10 w-10 place-items-center rounded-full"
        style={{
          background: tone === "ok" ? "rgba(34,197,94,0.12)" : "var(--brand-wash)",
          color: tone === "ok" ? "var(--ok)" : "var(--brand)",
        }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-ink-1 text-[14px] font-semibold">{title}</div>
        <div className="text-ink-3 mt-0.5 text-[12.5px]">{subtitle}</div>
        <div
          className="mt-2 text-[12px] font-medium"
          style={{ color: tone === "ok" ? "var(--ok)" : "var(--brand)" }}
        >
          {ctaLabel} →
        </div>
      </div>
    </a>
  );
}

function TourCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-[10px] border p-3"
      style={{ background: "var(--bg-app)", borderColor: "var(--line)" }}
    >
      <div className="flex items-start gap-2">
        <div
          className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
          style={{ background: "var(--brand-wash)", color: "var(--brand)" }}
        >
          {step}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-ink-1 text-[13px] font-semibold leading-tight">
            {title}
          </h4>
          <p className="text-ink-3 mt-1 text-[12px] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
