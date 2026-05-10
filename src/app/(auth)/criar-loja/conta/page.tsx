"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { signUpSchema } from "@/actions/auth/schema";
import { signUpStoreOwner } from "@/actions/auth/sign-up";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { SIGNUP_WHATSAPP_KEY } from "@/components/onboarding/storage-keys";
import { WhatsAppInput } from "@/components/onboarding/whatsapp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

// Schema local: extende signUpSchema com WhatsApp validado.
// WhatsApp NÃO é submetido pra action (signUpSchema atual) — é capturado
// e persistido em sessionStorage pra hidratação na tela 2 (identidade).
// Decisão: evitar mexer no Better Auth user table só pra carregar valor
// entre 2 telas. Ver memory `redesign-canvas-v1-onboarding-scope.md`.
const accountFormSchema = signUpSchema.extend({
  whatsappNumber: z.string().refine((v) => isValidWhatsAppBR(v), {
    message: "WhatsApp inválido. Use o formato com DDD (ex: 11 99999-9999).",
  }),
});
type AccountFormInput = z.infer<typeof accountFormSchema>;

export default function CriarContaPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const form = useForm<AccountFormInput>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      whatsappNumber: "",
    },
  });

  const password = form.watch("password");
  const passwordStrength = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordStrength).every(Boolean);

  const onSubmit = (values: AccountFormInput) => {
    if (!agreed) {
      toast.error("Aceite os Termos pra continuar.");
      return;
    }
    startTransition(async () => {
      // Persiste WhatsApp ANTES de chamar action — se signup falhar,
      // valor fica salvo pro próximo retry.
      try {
        sessionStorage.setItem(SIGNUP_WHATSAPP_KEY, values.whatsappNumber);
      } catch {
        // private mode / cookies disabled — segue silencioso.
      }

      const result = await signUpStoreOwner({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta criada!");
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  return (
    <OnboardingShell step={1}>
      <div className="grid h-full lg:grid-cols-2">
        {/* === Form column === */}
        <div className="mx-auto flex w-full max-w-[560px] flex-col justify-center px-6 py-10 sm:px-12 lg:py-[60px] lg:pl-[80px]">
          <p className="text-primary font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em]">
            Comece grátis · 14 dias
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.05] tracking-[-1px] sm:text-[36px]">
            Sua loja online <br className="hidden sm:block" />
            em <span className="text-primary">5 minutos</span>.
          </h1>
          <p className="text-muted-foreground mt-3 max-w-[460px] text-[14px] leading-[1.55]">
            Cadastre seus produtos, conecte seu WhatsApp e comece a vender.
            Sem mensalidade nos primeiros 14 dias.
          </p>

          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-8 flex flex-col gap-3.5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-[11.5px] font-medium">
                Seu nome
              </Label>
              <Input
                id="signup-name"
                autoComplete="name"
                placeholder="Como podemos te chamar?"
                disabled={isPending}
                aria-invalid={!!form.formState.errors.name}
                className="h-11"
                {...form.register("name")}
              />
              {form.formState.errors.name?.message ? (
                <p className="text-destructive text-[11px]">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-[11.5px] font-medium">
                E-mail
              </Label>
              <Input
                id="signup-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                placeholder="seu@email.com"
                disabled={isPending}
                aria-invalid={!!form.formState.errors.email}
                className="h-11"
                {...form.register("email")}
              />
              {form.formState.errors.email?.message ? (
                <p className="text-destructive text-[11px]">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-whatsapp" className="text-[11.5px] font-medium">
                WhatsApp
              </Label>
              <Controller
                name="whatsappNumber"
                control={form.control}
                render={({ field }) => (
                  <WhatsAppInput
                    id="signup-whatsapp"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isPending}
                    aria-invalid={!!form.formState.errors.whatsappNumber}
                  />
                )}
              />
              <p
                className={cn(
                  "text-[10.5px]",
                  form.formState.errors.whatsappNumber
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {form.formState.errors.whatsappNumber?.message ??
                  "Será o número que recebe os pedidos."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-password" className="text-[11.5px] font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Crie uma senha"
                  disabled={isPending}
                  aria-invalid={!!form.formState.errors.password}
                  className="h-11 pr-10"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-muted-foreground hocus:text-foreground absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {password.length > 0 ? (
                <div className="flex flex-wrap gap-3 pt-1">
                  <PasswordIndicator ok={passwordStrength.length} label="8+ caracteres" />
                  <PasswordIndicator ok={passwordStrength.letter} label="Letra" />
                  <PasswordIndicator ok={passwordStrength.number} label="Número" />
                </div>
              ) : (
                <p className="text-muted-foreground text-[10.5px]">
                  Mínimo 8 caracteres, com letra e número.
                </p>
              )}
              {form.formState.errors.password?.message ? (
                <p className="text-destructive text-[11px]">
                  {form.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 mt-4 h-12 gap-2 text-[14px] font-semibold"
              disabled={isPending || !isPasswordValid || !agreed}
            >
              {isPending ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Criando…
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </Button>

            <label className="flex cursor-pointer items-start gap-2 pt-1">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-3.5 cursor-pointer accent-primary"
              />
              <span className="text-muted-foreground text-[11px] leading-[1.55]">
                Ao continuar você concorda com os{" "}
                <Link
                  href="/termos"
                  className="text-foreground hocus:text-primary underline underline-offset-2"
                >
                  Termos
                </Link>{" "}
                e a{" "}
                <Link
                  href="/privacidade"
                  className="text-foreground hocus:text-primary underline underline-offset-2"
                >
                  Política de privacidade
                </Link>
                .
              </span>
            </label>
          </form>
        </div>

        {/* === Visual column (desktop only) === */}
        <aside className="bg-muted/50 relative hidden overflow-hidden border-l lg:block">
          {/* Gradient radial brand-tint top-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(circle at 70% 30%, var(--brand-tint), transparent 60%)",
            }}
          />
          <div className="relative flex h-full items-start gap-6 px-12 py-[60px] xl:gap-8">
            {/* Mini phone */}
            <div
              className="bg-card flex shrink-0 flex-col gap-2 rounded-[28px] border p-2.5 shadow-xl"
              style={{ width: 220, aspectRatio: "9 / 19" }}
            >
              <div className="h-4" aria-hidden />
              <div className="flex items-center gap-1.5 px-1.5">
                <span
                  aria-hidden
                  className="bg-primary size-[18px] rounded-[4px]"
                />
                <span className="text-[10px] font-semibold">Sua loja aqui</span>
              </div>
              <div
                aria-hidden
                className="rounded-lg"
                style={{
                  aspectRatio: "16 / 9",
                  background: "oklch(0.78 0.04 60)",
                }}
              />
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  "oklch(0.85 0.02 280)",
                  "oklch(0.45 0.03 270)",
                  "oklch(0.72 0.07 30)",
                  "oklch(0.65 0.05 170)",
                ].map((tone, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="rounded"
                    style={{ aspectRatio: "3 / 4", background: tone }}
                  />
                ))}
              </div>
            </div>

            {/* Benefits list */}
            <ul className="flex max-w-[240px] flex-col gap-[18px] pt-8">
              {[
                {
                  n: "01",
                  l: "Catálogo de produtos",
                  t: "Adicione fotos, preços e variantes.",
                },
                {
                  n: "02",
                  l: "Checkout WhatsApp",
                  t: "O cliente fecha a compra com você no WhatsApp.",
                },
                {
                  n: "03",
                  l: "Receba pelo Pix",
                  t: "Sem taxa de gateway. O dinheiro cai direto pra você.",
                },
              ].map((s) => (
                <li key={s.n}>
                  <p className="text-muted-foreground/70 font-mono text-[9.5px] tracking-[0.04em]">
                    {s.n}
                  </p>
                  <p className="mt-0.5 text-[13px] font-semibold">{s.l}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-[1.5]">
                    {s.t}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </OnboardingShell>
  );
}

function PasswordIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors",
        ok ? "text-success" : "text-muted-foreground/60",
      )}
    >
      {ok ? <CheckIcon className="size-3" /> : null}
      {label}
    </span>
  );
}
