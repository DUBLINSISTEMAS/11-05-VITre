"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resetPassword } from "@/actions/auth/reset-password";
import {
  type ResetPasswordInput,
  resetPasswordSchema,
} from "@/actions/auth/schema";
import { AuthShell } from "@/components/auth/auth-shell";

export default function RedefinirPage() {
  // useSearchParams precisa de Suspense boundary pro prerender do Next 15
  // não estourar (CSR bailout). Fallback é o card "Carregando" — usuário
  // raramente vê (token vem do email, página renderiza rápido).
  return (
    <Suspense
      fallback={
        <AuthShell title="Carregando…">
          <p className="text-ink-4 text-sm">Validando seu link…</p>
        </AuthShell>
      }
    >
      <RedefinirForm />
    </Suspense>
  );
}

function RedefinirForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [isPending, startTransition] = useTransition();

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = (values: ResetPasswordInput) => {
    startTransition(async () => {
      const result = await resetPassword(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Senha redefinida.");
      router.push(result.redirectTo);
    });
  };

  if (!token) {
    return (
      <AuthShell
        title="Link inválido"
        footer={
          <Link
            href="/recuperar"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Solicitar um novo link
          </Link>
        }
      >
        <p className="text-ink-4 text-sm">
          Este link parece estar quebrado ou expirou. Solicite um novo para
          redefinir sua senha.
        </p>
      </AuthShell>
    );
  }

  const passwordError = form.formState.errors.password?.message;
  const confirmError = form.formState.errors.confirmPassword?.message;

  return (
    <AuthShell
      title="Defina sua nova senha"
      subtitle="Use uma senha forte com pelo menos 8 caracteres."
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
        <input type="hidden" {...form.register("token")} />

        <div className="b3-field">
          <label htmlFor="new-password" className="b3-field-label">Nova senha</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="Pelo menos 8 caracteres"
            disabled={isPending}
            aria-invalid={!!passwordError}
            className="b3-input mono"
            {...form.register("password")}
          />
          {passwordError ? (
            <p className="mt-1 text-[11px] text-destructive">{passwordError}</p>
          ) : null}
        </div>

        <div className="b3-field">
          <label htmlFor="confirm-password" className="b3-field-label">Confirmar nova senha</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
            disabled={isPending}
            aria-invalid={!!confirmError}
            className="b3-input mono"
            {...form.register("confirmPassword")}
          />
          {confirmError ? (
            <p className="mt-1 text-[11px] text-destructive">{confirmError}</p>
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
              <Loader2 className="size-4 animate-spin" /> Salvando…
            </>
          ) : (
            <>
              Salvar nova senha <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
