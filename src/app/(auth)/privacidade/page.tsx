import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politica de Privacidade | Mangos Pay",
  description: "Politica de privacidade e protecao de dados da plataforma Mangos Pay.",
};

export default function PrivacidadePage() {
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

          <h1 className="text-2xl font-bold tracking-tight mb-2">Politica de Privacidade</h1>
          <p className="text-sm text-muted-foreground">
            Ultima atualizacao: Janeiro de 2025
          </p>
        </header>

        {/* Content */}
        <article className="prose prose-sm prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">1. Introducao</h2>
            <p className="text-muted-foreground leading-relaxed">
              A Mangos Pay esta comprometida em proteger sua privacidade. Esta politica descreve como coletamos, usamos e protegemos suas informacoes pessoais em conformidade com a Lei Geral de Protecao de Dados (LGPD).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">2. Dados Coletados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Coletamos os seguintes tipos de informacoes:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><strong>Dados de cadastro:</strong> nome, email, telefone</li>
              <li><strong>Dados da loja:</strong> nome da loja, endereco, nicho</li>
              <li><strong>Dados de uso:</strong> interacoes com a plataforma</li>
              <li><strong>Dados tecnicos:</strong> IP, navegador, dispositivo</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">3. Uso dos Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos seus dados para:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Fornecer e manter nossos servicos</li>
              <li>Personalizar sua experiencia</li>
              <li>Enviar comunicacoes importantes</li>
              <li>Melhorar a plataforma</li>
              <li>Cumprir obrigacoes legais</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">4. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Nao vendemos seus dados. Compartilhamos informacoes apenas com:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Provedores de servicos essenciais (hospedagem, email)</li>
              <li>Autoridades quando exigido por lei</li>
              <li>Parceiros com seu consentimento explicito</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">5. Seguranca</h2>
            <p className="text-muted-foreground leading-relaxed">
              Implementamos medidas de seguranca tecnicas e organizacionais para proteger seus dados, incluindo criptografia, controle de acesso e monitoramento continuo.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">6. Seus Direitos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Conforme a LGPD, voce tem direito a:
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar exclusao de dados</li>
              <li>Revogar consentimento</li>
              <li>Solicitar portabilidade dos dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">7. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analiticos para melhorar a experiencia. Voce pode gerenciar suas preferencias de cookies nas configuracoes do navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">8. Retencao de Dados</h2>
            <p className="text-muted-foreground leading-relaxed">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessario para cumprir obrigacoes legais. Apos exclusao da conta, os dados serao removidos em ate 30 dias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Contato</h2>
            <p className="text-muted-foreground leading-relaxed">
              Para exercer seus direitos ou esclarecer duvidas sobre privacidade, entre em contato com nosso Encarregado de Dados:{" "}
              <a href="mailto:privacidade@mangospay.app" className="text-primary hover:underline">
                privacidade@mangospay.app
              </a>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
