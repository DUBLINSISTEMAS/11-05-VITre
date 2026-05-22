import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso | Mangos Pay",
  description: "Termos e condicoes de uso da plataforma Mangos Pay.",
};

export default function TermosPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/criar-loja/conta"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/logos/logo.png"
              alt=""
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold">Mangos Pay</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-2">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">
            Ultima atualizacao: Janeiro de 2025
          </p>
        </header>

        {/* Content */}
        <article className="prose prose-sm prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">1. Aceitacao dos Termos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Ao acessar e utilizar a plataforma Mangos Pay, voce concorda em cumprir e estar vinculado a estes Termos de Uso. Se voce nao concordar com qualquer parte destes termos, nao devera usar nossos servicos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">2. Descricao do Servico</h2>
            <p className="text-muted-foreground leading-relaxed">
              A Mangos Pay e uma plataforma de comercio eletronico que permite a criacao e gerenciamento de lojas virtuais. Nossos servicos incluem:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Criacao de loja virtual personalizada</li>
              <li>Gerenciamento de produtos e categorias</li>
              <li>Integracao com WhatsApp para checkout</li>
              <li>Painel administrativo completo</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para utilizar nossos servicos, voce deve criar uma conta fornecendo informacoes verdadeiras e completas. Voce e responsavel por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">4. Uso Aceitavel</h2>
            <p className="text-muted-foreground leading-relaxed">
              Voce concorda em utilizar a plataforma apenas para fins legais e de acordo com estes Termos. E proibido:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Vender produtos ilegais ou proibidos</li>
              <li>Violar direitos de propriedade intelectual</li>
              <li>Praticar fraudes ou enganar consumidores</li>
              <li>Interferir na operacao da plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">5. Propriedade Intelectual</h2>
            <p className="text-muted-foreground leading-relaxed">
              Todo o conteudo da plataforma, incluindo marca, design e codigo, e propriedade da Mangos Pay. Voce mantem a propriedade do conteudo que voce cria em sua loja.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">6. Limitacao de Responsabilidade</h2>
            <p className="text-muted-foreground leading-relaxed">
              A Mangos Pay nao se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso da plataforma. Nosso limite maximo de responsabilidade sera o valor pago pelo usuario nos ultimos 12 meses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">7. Modificacoes</h2>
            <p className="text-muted-foreground leading-relaxed">
              Reservamos o direito de modificar estes Termos a qualquer momento. Alteracoes significativas serao comunicadas por email ou notificacao na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para duvidas sobre estes Termos, entre em contato pelo email:{" "}
              <a href="mailto:suporte@mangospay.app" className="text-primary hover:underline">
                suporte@mangospay.app
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
