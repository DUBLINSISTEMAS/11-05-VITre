"use client";

import { ArrowLeftIcon, CheckIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createStore } from "@/actions/store/create-store";
import { type CreateStoreInput } from "@/actions/store/schema";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import {
  ONBOARDING_IDENTITY_KEY,
  SIGNUP_WHATSAPP_KEY,
} from "@/components/onboarding/storage-keys";

// 4 nichos visuais — Dublin v3 handoff usa 6 chips, Vitrê schema só aceita 4.
const NICHE_CARDS = [
  { value: "roupa_feminina", label: "Roupa" },
  { value: "joia", label: "Joia" },
  { value: "semijoia", label: "Semijoia" },
  { value: "perfumaria", label: "Perfumaria" },
] as const;

type Niche = (typeof NICHE_CARDS)[number]["value"];

type IdentitySnapshot = Pick<
  CreateStoreInput,
  | "name"
  | "slug"
  | "whatsappNumber"
  | "primaryColor"
  | "addressCity"
  | "addressState"
>;

export default function CriarLojaTipoNegocioPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [niche, setNiche] = useState<Niche>("roupa_feminina");
  const [includeCategories, setIncludeCategories] = useState(true);
  const [identity, setIdentity] = useState<IdentitySnapshot | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ONBOARDING_IDENTITY_KEY);
      if (!stored) {
        router.replace("/criar-loja/identidade");
        return;
      }
      const parsed = JSON.parse(stored) as IdentitySnapshot;
      if (!parsed.name || !parsed.slug) {
        router.replace("/criar-loja/identidade");
        return;
      }
      setIdentity(parsed);
      setHydrated(true);
    } catch {
      router.replace("/criar-loja/identidade");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = () => {
    if (!identity) return;
    startTransition(async () => {
      const result = await createStore({
        ...identity,
        niche,
        includeNicheCategories: includeCategories,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      try {
        sessionStorage.removeItem(SIGNUP_WHATSAPP_KEY);
        sessionStorage.removeItem(ONBOARDING_IDENTITY_KEY);
      } catch {
        /* ignore */
      }
      router.push(result.redirectTo);
      router.refresh();
    });
  };

  if (!hydrated) {
    return (
      <OnboardingShell step={3}>
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-5 animate-spin text-ink-4" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={3}
      footerLeft={
        <Link href="/criar-loja/identidade" className="b3-btn">
          <ArrowLeftIcon className="size-3.5" /> Voltar
        </Link>
      }
      footerRight={
        <button
          type="button"
          onClick={onSubmit}
          className="b3-btn b3-btn--cta"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Criando sua loja…
            </>
          ) : (
            <>
              <CheckIcon className="size-3.5" /> Criar minha loja
            </>
          )}
        </button>
      }
    >
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
        PASSO 3 DE 4
      </span>
      <h2 className="mt-2 mb-1.5 text-[26px] font-bold tracking-[-0.02em] text-ink-1">
        Que tipo de loja você tem?
      </h2>
      <p className="mb-6 text-[14px] text-ink-3">
        Usamos pra preparar categorias e exemplos relevantes pro seu nicho.
      </p>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {NICHE_CARDS.map((n) => {
          const active = niche === n.value;
          return (
            <button
              key={n.value}
              type="button"
              onClick={() => setNiche(n.value)}
              disabled={isPending}
              aria-pressed={active}
              className="cursor-pointer transition-colors"
              style={{
                padding: 16,
                background: active ? "var(--brand-wash)" : "white",
                border: `1.5px solid ${active ? "var(--brand)" : "var(--line)"}`,
                borderRadius: 12,
                textAlign: "left",
                fontSize: 14,
                fontWeight: 600,
                color: active ? "var(--brand)" : "var(--ink-1)",
              }}
            >
              {n.label}
            </button>
          );
        })}
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-4 transition-colors hocus-within:border-line-2">
        <input
          type="checkbox"
          checked={includeCategories}
          onChange={(e) => setIncludeCategories(e.target.checked)}
          disabled={isPending}
          className="mt-0.5 size-4 cursor-pointer accent-brand"
          aria-label="Criar categorias sugeridas do nicho"
        />
        <div className="flex-1">
          <span className="block text-[13px] font-medium text-ink-1">
            Criar categorias sugeridas
          </span>
          <p className="mt-0.5 text-[11.5px] leading-[1.4] text-ink-4">
            Adicionamos algumas categorias comuns do seu nicho. Você pode
            editar, renomear ou apagar depois.
          </p>
        </div>
      </label>
    </OnboardingShell>
  );
}
