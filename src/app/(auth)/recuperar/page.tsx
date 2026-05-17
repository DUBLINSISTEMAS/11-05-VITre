"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon } from "lucide-react";
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
          <Link href="/entrar" className="text-foreground font-medium underline-offset-4 hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2Icon className="text-brand size-10" aria-hidden />
          <p className="text-sm leading-relaxed">
            Se existe uma conta com esse email, enviamos um link para redefinir
            a senha. Confira sua caixa de entrada e a pasta de spam.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Vamos enviar um link de redefinição para seu email."
      footer={
        <Link href="/entrar" className="text-foreground font-medium underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    placeholder="voce@email.com"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      </Form>
    </AuthShell>
  );
}
