"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resetPassword } from "@/actions/auth/reset-password";
import { type ResetPasswordInput,resetPasswordSchema } from "@/actions/auth/schema";
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

export default function RedefinirPage() {
  // useSearchParams precisa de Suspense boundary pro prerender do Next 15
  // não estourar (CSR bailout). Fallback é o card "Carregando" — usuário
  // raramente vê (token vem do email, página renderiza rápido).
  return (
    <Suspense
      fallback={
        <AuthShell title="Carregando…">
          <p className="text-ink-4 text-sm">
            Validando seu link…
          </p>
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

  return (
    <AuthShell
      title="Defina sua nova senha"
      subtitle="Use uma senha forte com pelo menos 8 caracteres."
      footer={
        <Link href="/entrar" className="text-foreground font-medium underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...form.register("token")} />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Pelo menos 8 caracteres"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar nova senha</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
