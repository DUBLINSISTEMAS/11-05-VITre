import {
  BookOpenIcon,
  HelpCircleIcon,
  MailIcon,
  MessageCircleIcon,
  PlayCircleIcon,
} from "lucide-react";

import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const VITRE_SUPPORT_WA = "5599981757512"; // founder WhatsApp
const VITRE_SUPPORT_EMAIL = "felipe@vitre.site";

/**
 * Suporte — placeholder UI (B.6). Sem backend de ticket. Canais externos:
 * WhatsApp do founder, email, link FAQ futuro.
 */
export default async function SuportePage() {
  await requireSession();

  const waUrl = `https://wa.me/${VITRE_SUPPORT_WA}?text=${encodeURIComponent(
    "Olá, sou usuário do Vitrê e preciso de ajuda com:",
  )}`;
  const emailUrl = `mailto:${VITRE_SUPPORT_EMAIL}?subject=${encodeURIComponent("Suporte Vitrê")}`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Suporte
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Canais de ajuda · documentação · primeiros passos.
        </p>
      </div>

      {/* Canais primários */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ChannelCard
          icon={MessageCircleIcon}
          title="WhatsApp"
          subtitle="Resposta em até 1 dia útil"
          ctaLabel="Abrir conversa"
          href={waUrl}
          target="_blank"
          tone="ok"
        />
        <ChannelCard
          icon={MailIcon}
          title="Email"
          subtitle={VITRE_SUPPORT_EMAIL}
          ctaLabel="Enviar email"
          href={emailUrl}
        />
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
            description="Comece em /admin/produtos. Cada produto pode ter fotos, preço promo, variantes e atributos."
          />
          <TourCard
            step="2"
            title="Configure seu storefront"
            description="Em /admin/aparencia, escolha cor da marca e modelo da loja. Em /admin/banners, suba destaques."
          />
          <TourCard
            step="3"
            title="Compartilhe seu link"
            description={`Seu link público fica em vitre.site/<sua-loja>. Compartilhe no Instagram, Stories, link na bio.`}
          />
          <TourCard
            step="4"
            title="Receba pedidos pelo WhatsApp"
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
            description="Em /admin/relatorios, veja vendas, top produtos, clientes e leads do período."
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
  "Como meus clientes finalizam compras? Pelo WhatsApp — Vitrê não processa pagamento.",
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
  icon: typeof MessageCircleIcon;
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
