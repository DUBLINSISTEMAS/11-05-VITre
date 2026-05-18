import { CheckIcon, SparklesIcon } from "lucide-react";

import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/**
 * Assinatura — placeholder UI (B.5). Sem backend Stripe (não nesta versão).
 * Mostra plano atual (Trial) + 3 níveis previstos com CTA disabled.
 */
export default async function AssinaturaPage() {
  await requireSession();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Assinatura
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Plano atual e opções de upgrade.
        </p>
      </div>

      {/* Plano atual */}
      <div
        className="b3-card b3-card-pad flex flex-wrap items-center justify-between gap-3"
        style={{
          background: "var(--brand-wash)",
          borderColor: "var(--brand-line)",
        }}
      >
        <div className="flex items-center gap-3">
          <SparklesIcon size={20} style={{ color: "var(--brand)" }} />
          <div>
            <div
              className="text-[15px] font-bold"
              style={{ color: "var(--brand)" }}
            >
              Você está no plano Trial
            </div>
            <div className="text-ink-3 mt-0.5 text-[12.5px]">
              Acesso completo durante a fase de testes · sem cobrança.
            </div>
          </div>
        </div>
      </div>

      {/* 3 planos previstos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <PlanCard
          name="Starter"
          price="R$ 39"
          period="/mês"
          tag="Para começar"
          features={[
            "Até 30 produtos",
            "PDV + Estoque + Clientes",
            "Storefront público",
            "Suporte por email",
          ]}
        />
        <PlanCard
          name="Pro"
          price="R$ 79"
          period="/mês"
          tag="Mais escolhido"
          highlighted
          features={[
            "Até 200 produtos",
            "Tudo do Starter +",
            "Cupons, Atributos, Grupos",
            "Equipe (3 usuários)",
            "Suporte prioritário",
          ]}
        />
        <PlanCard
          name="Business"
          price="R$ 149"
          period="/mês"
          tag="Sem limite"
          features={[
            "Produtos ilimitados",
            "Tudo do Pro +",
            "Equipe ilimitada",
            "Múltiplas lojas",
            "Suporte WhatsApp dedicado",
          ]}
        />
      </div>

      <div className="b3-card b3-card-pad">
        <h3 className="text-ink-1 text-[14px] font-bold">FAQ</h3>
        <div className="text-ink-3 mt-3 space-y-3 text-[12.5px] leading-relaxed">
          <div>
            <b className="text-ink-1">Quando começa a cobrança?</b>
            <br />
            Após o lançamento da assinatura formal. Trial atual segue grátis.
          </div>
          <div>
            <b className="text-ink-1">Posso cancelar quando quiser?</b>
            <br />
            Sim, sem fidelidade. O acesso permanece até o fim do mês pago.
          </div>
          <div>
            <b className="text-ink-1">Vitrê processa pagamentos?</b>
            <br />
            Não. Você combina forma de pagamento com seu cliente via WhatsApp
            ou registra no PDV (PIX/dinheiro/cartão no seu próprio POS).
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  period,
  tag,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  period: string;
  tag: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className="b3-card b3-card-pad flex flex-col"
      style={{
        borderColor: highlighted ? "var(--brand)" : undefined,
        borderWidth: highlighted ? 2 : 1,
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-ink-1 text-[18px] font-bold">{name}</div>
          <div className="text-ink-4 mt-0.5 text-[11px] tracking-[0.06em] uppercase">
            {tag}
          </div>
        </div>
        {highlighted && (
          <span
            className="b3-pill"
            style={{
              background: "var(--brand)",
              color: "white",
              borderColor: "transparent",
            }}
          >
            Recomendado
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span
          className="mono text-[28px] font-bold tracking-[-0.02em]"
          style={{ color: highlighted ? "var(--brand)" : "var(--ink-1)" }}
        >
          {price}
        </span>
        <span className="text-ink-4 text-[13px]">{period}</span>
      </div>

      <ul className="mt-4 flex-1 space-y-2">
        {features.map((f, i) => (
          <li
            key={i}
            className="text-ink-2 flex items-start gap-2 text-[12.5px]"
          >
            <CheckIcon
              size={13}
              style={{ color: "var(--ok)", marginTop: 2, flexShrink: 0 }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled
        className="b3-btn mt-5 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          height: 40,
          background: highlighted ? "var(--brand)" : undefined,
          color: highlighted ? "white" : undefined,
          borderColor: highlighted ? "transparent" : undefined,
        }}
        title="Disponível em breve"
      >
        {highlighted ? "Assinar Pro · em breve" : "Em breve"}
      </button>
    </div>
  );
}
