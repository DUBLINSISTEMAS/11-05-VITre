"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Rocket, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export default function BemVindoPage() {
  return (
    <Suspense fallback={<WelcomeSkeleton />}>
      <WelcomeContent />
    </Suspense>
  );
}

function WelcomeSkeleton() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-background to-muted/30">
      <div className="size-8 animate-pulse rounded-full bg-muted" />
    </main>
  );
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeName = searchParams.get("nome") || "Sua Loja";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.push("/admin");
          router.refresh();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-8 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 1 }}
          className="absolute -top-1/4 -right-1/4 size-[600px] rounded-full bg-primary/30 blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.08, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -bottom-1/4 -left-1/4 size-[500px] rounded-full bg-primary/20 blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative flex flex-col items-center text-center max-w-md"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="relative mb-6"
        >
          <div className="size-20 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="size-10 text-success" />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute -top-1 -right-1"
          >
            <Sparkles className="size-6 text-warning" />
          </motion.div>
        </motion.div>

        {/* Store icon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/logo-principal.webp"
              alt=""
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-lg font-bold text-foreground">Vitre</span>
          </Link>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-bold tracking-tight text-foreground mb-2"
        >
          Parabens!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-muted-foreground mb-2"
        >
          A <span className="font-semibold text-foreground">{storeName}</span> está no ar!
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm text-muted-foreground mb-8"
        >
          Sua loja virtual foi criada com sucesso e ja esta disponivel para seus clientes.
        </motion.p>

        {/* Features created */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="w-full bg-card rounded-xl border border-border/50 p-4 mb-6"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Criamos para voce:
          </p>
          <div className="space-y-2">
            {[
              "Categorias iniciais do seu nicho",
              "Página da loja configurada",
              "Checkout via WhatsApp pronto",
            ].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="flex items-center gap-2 text-sm"
              >
                <div className="size-5 rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="size-3 text-success" />
                </div>
                <span className="text-foreground">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="w-full"
        >
          <Button
            asChild
            size="lg"
            className="w-full h-12 font-semibold gap-2 group"
          >
            <Link href="/admin">
              <Rocket className="size-4" />
              Ir para o Painel
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Auto redirect notice */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-4 text-xs text-muted-foreground"
        >
          Redirecionando em {countdown}s...
        </motion.p>
      </motion.div>
    </main>
  );
}
