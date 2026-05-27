"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckIcon, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { type SignInInput, signInSchema } from "@/actions/auth/schema";
import { signInWithEmail } from "@/actions/auth/sign-in";
import { AnimatedAuthButton } from "@/components/auth/animated-auth-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { cn } from "@/lib/utils";

export default function EntrarPage() {
  return (
    <Suspense fallback={<EntrarSkeleton />}>
      <EntrarContent />
    </Suspense>
  );
}

function EntrarSkeleton() {
  return (
    <AuthShell title="Entre na sua conta" subtitle="Carregando…">
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-ink-4" />
      </div>
    </AuthShell>
  );
}

function EntrarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (searchParams.get("reset") === "ok") {
      toast.success("Senha redefinida!", {
        description: "Faca login com sua nova senha.",
      });
    }
  }, [searchParams]);

  const onSubmit = (values: SignInInput) => {
    startTransition(async () => {
      const result = await signInWithEmail(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Bem-vindo de volta!");
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <AuthShell
      title="Entre na sua conta"
      subtitle="Bem-vinda de volta. Continue de onde parou."
      footer={
        <>
          Ainda não tem loja?{" "}
          <Link
            href="/criar-loja/conta"
            className="font-semibold text-brand hover:underline underline-offset-4"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
        <div className="b3-field">
          <label htmlFor="email" className="b3-field-label">E-mail</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            placeholder="seu@email.com"
            disabled={isPending}
            aria-invalid={!!emailError}
            className="b3-input mono"
            {...form.register("email")}
          />
          {emailError ? (
            <p className="mt-1 text-[11px] text-destructive">{emailError}</p>
          ) : null}
        </div>

        <div className="b3-field">
          <label htmlFor="password" className="b3-field-label">Senha</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Sua senha"
              disabled={isPending}
              aria-invalid={!!passwordError}
              className="b3-input mono pr-10"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2",
                "text-ink-4 hover:text-ink-1 transition-colors",
              )}
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError ? (
            <p className="mt-1 text-[11px] text-destructive">{passwordError}</p>
          ) : null}
        </div>

        <div className="mb-[18px] flex items-center justify-between text-[13px]">
          <label className="b3-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="b3-checkbox-box">
              <CheckIcon size={11} strokeWidth={3} />
            </span>
            <span>Lembrar login</span>
          </label>
          <Link
            href="/recuperar"
            className="text-brand font-semibold hover:underline underline-offset-4"
            tabIndex={-1}
          >
            Esqueceu a senha?
          </Link>
        </div>

        <AnimatedAuthButton type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Entrando…
            </>
          ) : (
            <>
              Entrar <ArrowRight className="size-4" />
            </>
          )}
        </AnimatedAuthButton>
      </form>
    </AuthShell>
  );
}
