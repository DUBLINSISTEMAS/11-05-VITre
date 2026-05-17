"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { type SignInInput, signInSchema } from "@/actions/auth/schema";
import { signInWithEmail } from "@/actions/auth/sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
    <AuthShell title="Entrar" subtitle="Acesse sua conta">
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

  return (
    <AuthShell
      title="Entre na sua conta"
      subtitle="Bem-vindo de volta. Continue de onde parou."
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
      {/* Stagger fade-in migrado de framer-motion → tw-animate-css (Onda 4
          auditoria 2026-05-10). `[animation-fill-mode:backwards]` evita
          flash do conteúdo antes do delay disparar. */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="animate-in fade-in slide-in-from-left-3 duration-300 [animation-delay:100ms] [animation-fill-mode:backwards]">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-ink-4 uppercase tracking-wide">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="off"
                      placeholder="seu@email.com"
                      disabled={isPending}
                      className="h-10 bg-bg-app border-0 focus-visible:ring-1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="animate-in fade-in slide-in-from-left-3 duration-300 [animation-delay:150ms] [animation-fill-mode:backwards]">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs font-medium text-ink-4 uppercase tracking-wide">
                      Senha
                    </FormLabel>
                    <Link
                      href="/recuperar"
                      className="text-xs text-ink-4 hover:text-brand transition-colors"
                      tabIndex={-1}
                    >
                      Esqueceu?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Sua senha"
                        disabled={isPending}
                        className="h-10 bg-bg-app border-0 focus-visible:ring-1 pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={cn(
                          "absolute right-3 top-1/2 -translate-y-1/2",
                          "text-ink-4 hover:text-ink-1 transition-colors"
                        )}
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:200ms] [animation-fill-mode:backwards]">
            <Button
              type="submit"
              className="w-full h-10 font-medium gap-2 group"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </AuthShell>
  );
}
