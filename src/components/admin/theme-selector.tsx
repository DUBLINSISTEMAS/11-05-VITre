"use client";

/**
 * ThemeSelector — UI de escolha de tema (Onda C).
 *
 * 3 cards radio com mini-mockup SVG (ThemePreview), nome, descrição e
 * botão "Aplicar". Card do preset atual marcado como "Modelo atual".
 *
 * Detecção do preset atual: comparação dos 4 eixos em
 * `detectActivePreset()`. Se a combinação não bate com nenhum preset
 * (caso hipotético — não há fluxo de override individual hoje), mostra
 * aviso "modelo customizado".
 *
 * Sem confirmação destrutiva: a aplicação é reversível (basta clicar em
 * outro preset). Sem destruir produtos/categorias.
 */
import { CheckIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { applyTheme } from "@/actions/store/apply-theme";
import { Button } from "@/components/ui/button";
import {
  detectActivePreset,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  type ThemePresetId,
} from "@/lib/storefront/themes";
import { cn } from "@/lib/utils";

import { ThemePreview } from "./theme-preview";

interface ThemeSelectorProps {
  currentTheme: {
    categoryShape: string;
    productCardStyle: string;
    heroStyle: string;
    bottomNavStyle: string;
  };
}

export function ThemeSelector({ currentTheme }: ThemeSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [applyingId, setApplyingId] = useState<ThemePresetId | null>(null);

  const activePresetId = detectActivePreset(currentTheme);

  const onApply = (presetId: ThemePresetId) => {
    if (presetId === activePresetId) {
      toast.info("Esse modelo já está aplicado.");
      return;
    }
    setApplyingId(presetId);
    startTransition(async () => {
      try {
        const result = await applyTheme({ presetId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Modelo aplicado.");
        router.refresh();
      } finally {
        setApplyingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {activePresetId === null && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
          <SparklesIcon className="mt-0.5 size-4 shrink-0" />
          <p className="text-xs leading-relaxed">
            Sua vitrine está com uma combinação personalizada. Aplicar um
            modelo abaixo vai sobrescrever as configurações atuais.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEME_PRESET_IDS.map((id) => {
          const preset = THEME_PRESETS[id];
          const isActive = id === activePresetId;
          const isApplying = applyingId === id && isPending;

          return (
            <article
              key={id}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
                isActive
                  ? "border-foreground/30 ring-2 ring-foreground/10"
                  : "border-border hover:border-foreground/20",
              )}
            >
              {isActive && (
                <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-background">
                  <CheckIcon className="size-2.5" /> Atual
                </span>
              )}

              <div className="bg-muted/40 p-3">
                <ThemePreview preset={preset} />
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <header>
                  <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
                    {preset.name}
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {preset.description}
                  </p>
                </header>

                <Button
                  type="button"
                  variant={isActive ? "outline" : "default"}
                  onClick={() => onApply(id)}
                  disabled={isPending || isActive}
                  className="mt-auto"
                >
                  {isApplying ? (
                    <>
                      <Loader2Icon className="animate-spin" /> Aplicando…
                    </>
                  ) : isActive ? (
                    "Modelo atual"
                  ) : (
                    "Aplicar modelo"
                  )}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Trocar de modelo é seguro e não afeta seus produtos, categorias ou
        pedidos — apenas o visual da vitrine. Você pode mudar quantas vezes
        quiser.
      </p>
    </div>
  );
}
