"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Show step indicator for onboarding flow */
  step?: { current: number; total: number; labels?: string[] };
  /** Compact mode for multi-step forms */
  compact?: boolean;
}

/**
 * Premium auth card wrapper with modern styling.
 * Fullstack-level design with smooth animations and refined aesthetics.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  className,
  step,
  compact = false,
}: AuthCardProps) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn(
          "relative w-full space-y-5",
          compact ? "max-w-[400px]" : "max-w-[420px]",
          className
        )}
      >
        {/* Logo */}
        <Link
          href="/"
          className="mx-auto flex w-fit items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
          aria-label="Vitre"
        >
          <Image
            src="/brand/logo-principal.webp"
            alt=""
            width={36}
            height={36}
            priority
            className="rounded-lg"
          />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Vitre
          </span>
        </Link>

        {/* Step indicator */}
        {step && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: step.total }).map((_, idx) => (
                <motion.div
                  key={idx}
                  initial={false}
                  animate={{
                    width: idx === step.current - 1 ? 24 : 8,
                    backgroundColor: idx < step.current 
                      ? "hsl(var(--primary))" 
                      : "hsl(var(--muted))"
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full"
                />
              ))}
            </div>
            {step.labels && step.labels[step.current - 1] && (
              <span className="text-xs text-muted-foreground">
                {step.labels[step.current - 1]}
              </span>
            )}
          </div>
        )}

        {/* Card */}
        <motion.div 
          layout
          className="bg-card rounded-2xl border border-border/50 p-6 shadow-xl shadow-black/[0.03] sm:p-7"
        >
          {/* Header */}
          <div className={cn("space-y-1 text-center", compact ? "mb-5" : "mb-6")}>
            <h1 className={cn(
              "font-bold tracking-tight text-foreground",
              compact ? "text-xl" : "text-2xl"
            )}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm">
                {subtitle}
              </p>
            )}
          </div>

          {/* Content */}
          {children}
        </motion.div>

        {/* Footer */}
        {footer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground text-center text-sm"
          >
            {footer}
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
