"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { type SignUpInput, signUpSchema } from "@/actions/auth/schema";
import { signUpStoreOwner } from "@/actions/auth/sign-up";
import { AuthCard } from "@/components/auth/auth-card";
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

export default function CriarContaPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const password = form.watch("password");
  const passwordStrength = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const isPasswordValid = Object.values(passwordStrength).every(Boolean);

  const onSubmit = (values: SignUpInput) => {
    if (!agreed) {
      toast.error("Aceite os termos para continuar.");
      return;
    }
    startTransition(async () => {
      const result = await signUpStoreOwner(values);
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
    <AuthCard
      title="Crie sua conta"
      subtitle="Comece sua loja em minutos"
      step={{ current: 1, total: 3, labels: ["Conta", "Loja", "Pronto"] }}
      compact
      footer={
        <>
          Ja tem conta?{" "}
          <Link
            href="/entrar"
            className="text-primary font-medium hover:underline underline-offset-4"
          >
            Entrar
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Seu nome
                  </FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder="Como podemos te chamar?"
                      disabled={isPending}
                      className="h-10 bg-muted/30 border-0 focus-visible:ring-1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
                      className="h-10 bg-muted/30 border-0 focus-visible:ring-1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Senha
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Crie uma senha"
                        disabled={isPending}
                        className="h-10 bg-muted/30 border-0 focus-visible:ring-1 pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />

                  {/* Password strength - compact inline */}
                  <AnimatePresence>
                    {password.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-3 pt-2"
                      >
                        <PasswordIndicator ok={passwordStrength.length} label="8+ chars" />
                        <PasswordIndicator ok={passwordStrength.letter} label="Letra" />
                        <PasswordIndicator ok={passwordStrength.number} label="Numero" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </FormItem>
              )}
            />
          </motion.div>

          {/* Terms checkbox */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <label className="flex items-start gap-2.5 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={cn(
                    "size-4 rounded border-2 transition-all flex items-center justify-center",
                    agreed
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40 group-hover:border-muted-foreground"
                  )}
                >
                  {agreed && <Check className="size-3 text-primary-foreground" />}
                </div>
              </div>
              <span className="text-xs text-muted-foreground leading-relaxed">
                Li e concordo com os{" "}
                <Link href="/termos" className="text-primary hover:underline">
                  Termos de Uso
                </Link>{" "}
                e{" "}
                <Link href="/privacidade" className="text-primary hover:underline">
                  Politica de Privacidade
                </Link>
              </span>
            </label>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              type="submit"
              className="w-full h-10 font-medium gap-2 group"
              disabled={isPending || !isPasswordValid || !agreed}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </motion.div>
        </form>
      </Form>
    </AuthCard>
  );
}

function PasswordIndicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium transition-colors",
        ok ? "text-success" : "text-muted-foreground/60"
      )}
    >
      {ok && <Check className="inline size-3 mr-0.5" />}
      {label}
    </span>
  );
}
