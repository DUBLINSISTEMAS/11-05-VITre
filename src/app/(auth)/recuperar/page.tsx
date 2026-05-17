"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2Icon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestPasswordReset } from "@/actions/auth/request-password-reset";
import {
  type RequestPasswordResetInput,
  requestPasswordResetSchema,
} from "@/actions/auth/schema";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RecuperarPage() {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: RequestPasswordResetInput) => {
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <AuthShell
        title="Verifique seu email"
        footer={
          <Link
            href="/entrar"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Voltar para o login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2Icon className="text-brand size-10" aria-hidden />
          <p className="text-sm leading-relaxed text-ink-3">
            Se existe uma conta com esse email, enviamos um link para redefinir
            a senha. Confira sua caixa de entrada e a pasta de spam.
          </p>
        </div>
      </AuthShell>
    );
  }

  const emailError = form.formState.errors.email?.message;

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Vamos enviar um link de redefinição para seu email."
      footer={
        <Link
          href="/entrar"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="b3-field">
          <label htmlFor="recover-email" className="b3-field-label">E-mail</label>
          <input
            id="recover-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            placeholder="voce@email.com"
            disabled={isPending}
            aria-invalid={!!emailError}
            className="b3-input mono"
            {...form.register("email")}
          />
          {emailError ? (
            <p className="mt-1 text-[11px] text-destructive">{emailError}</p>
          ) : null}
        </div>

        <button
          type="submit"
          className="b3-btn b3-btn--cta w-full justify-center"
          style={{ height: 48, fontSize: 14, fontWeight: 700 }}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Enviando…
            </>
          ) : (
            <>
              Enviar link <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
