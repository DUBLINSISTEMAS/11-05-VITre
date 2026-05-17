"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { isValidWhatsAppBR } from "@/lib/whatsapp-format";

// Schema local: extende signUpSchema com WhatsApp validado.
// WhatsApp NÃO é submetido pra action — é capturado e persistido em
// sessionStorage pra hidratação na tela 2 (identidade).
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
      try {
        sessionStorage.setItem(SIGNUP_WHATSAPP_KEY, values.whatsappNumber);
      } catch {
        /* private mode — silencioso */
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

  const errors = form.formState.errors;

  return (
    <OnboardingShell
      step={1}
      footerRight={
        <button
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          className="b3-btn b3-btn--cta"
          disabled={isPending || !isPasswordValid || !agreed}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Criando…
            </>
          ) : (
            <>
              Continuar <ArrowRightIcon className="size-3.5" />
            </>
          )}
        </button>
      }
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
        PASSO 1 DE 4
      </span>
      <h2 className="mt-2 mb-1.5 text-[26px] font-bold tracking-[-0.02em] text-ink-1">
        Vamos começar com seus dados
      </h2>
      <p className="mb-6 text-[14px] text-ink-3">
        Você é a dona da loja. Esses dados ficam só pra você.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="b3-row2">
          <div className="b3-field">
            <label htmlFor="signup-name" className="b3-field-label">Seu nome</label>
            <input
              id="signup-name"
              autoComplete="name"
              placeholder="Como devo te chamar?"
              disabled={isPending}
              aria-invalid={!!errors.name}
              className="b3-input"
              {...form.register("name")}
            />
            {errors.name?.message ? (
              <p className="mt-1 text-[11px] text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="b3-field">
            <label htmlFor="signup-whatsapp" className="b3-field-label">WhatsApp</label>
            <Controller
              name="whatsappNumber"
              control={form.control}
              render={({ field }) => (
                <WhatsAppInput
                  id="signup-whatsapp"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                  aria-invalid={!!errors.whatsappNumber}
                />
              )}
            />
            {errors.whatsappNumber?.message ? (
              <p className="mt-1 text-[11px] text-destructive">{errors.whatsappNumber.message}</p>
            ) : (
              <p className="mt-1 text-[10.5px] text-ink-4">Será o número que recebe os pedidos.</p>
            )}
          </div>
        </div>

        <div className="b3-field">
          <label htmlFor="signup-email" className="b3-field-label">E-mail</label>
          <input
            id="signup-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            placeholder="seu@email.com"
            disabled={isPending}
            aria-invalid={!!errors.email}
            className="b3-input mono"
            {...form.register("email")}
          />
          {errors.email?.message ? (
            <p className="mt-1 text-[11px] text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="b3-field">
          <label htmlFor="signup-password" className="b3-field-label">Senha</label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              disabled={isPending}
              aria-invalid={!!errors.password}
              className="b3-input mono pr-10"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-ink-4 hocus:text-ink-1 absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
          {password.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-3">
              <PasswordIndicator ok={passwordStrength.length} label="8+ caracteres" />
              <PasswordIndicator ok={passwordStrength.letter} label="Letra" />
              <PasswordIndicator ok={passwordStrength.number} label="Número" />
            </div>
          ) : (
            <p className="mt-1 text-[10.5px] text-ink-4">
              Mínimo 8 caracteres, com letra e número.
            </p>
          )}
          {errors.password?.message ? (
            <p className="mt-1 text-[11px] text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <label className="mt-2 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-3.5 cursor-pointer accent-brand"
          />
          <span className="text-[11px] leading-[1.55] text-ink-4">
            Ao continuar você concorda com os{" "}
            <Link
              href="/termos"
              className="text-foreground hocus:text-brand underline underline-offset-2"
            >
              Termos
            </Link>{" "}
            e a{" "}
            <Link
              href="/privacidade"
              className="text-foreground hocus:text-brand underline underline-offset-2"
            >
              Política de privacidade
            </Link>
            .
          </span>
        </label>

        {/* Submit hidden — Enter key dispara via form onSubmit */}
        <button type="submit" hidden tabIndex={-1} />
      </form>
    </OnboardingShell>
  );
}

function PasswordIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-medium transition-colors",
        ok ? "text-success" : "text-ink-5",
      )}
    >
      {ok ? <CheckIcon className="size-3" /> : null}
      {label}
    </span>
  );
}
