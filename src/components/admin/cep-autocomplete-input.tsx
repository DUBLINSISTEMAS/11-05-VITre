"use client";

/**
 * Bloco I UX (2026-05-29) — input de CEP com autocomplete via ViaCEP.
 *
 * Quando lojista digita 8 dígitos, dispara fetch público à ViaCEP
 * (https://viacep.com.br/ws/{cep}/json/) e devolve street/neighborhood/
 * city/state pro caller via `onResolved`. Cache local simples evita
 * refetches do mesmo CEP.
 *
 * Anti-spam: debounced 400ms. Spinner inline durante o fetch.
 *
 * Falha silenciosa: se ViaCEP estiver fora do ar ou CEP não existir,
 * só não autocompleta — lojista digita o endereço manual sem fricção.
 */

import { Loader2Icon, MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export interface CepResolvedData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface CepAutocompleteInputProps {
  id?: string;
  value: string;
  onChangeValue: (v: string) => void;
  onResolved: (data: CepResolvedData) => void;
  onBlur?: () => void;
  disabled?: boolean;
}

// Cache global (escopo de página). Evita refetch ao trocar foco.
const cepCache = new Map<string, CepResolvedData | "not_found">();

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

async function fetchViaCep(cep: string): Promise<CepResolvedData | null> {
  if (cep.length !== 8) return null;
  const cached = cepCache.get(cep);
  if (cached === "not_found") return null;
  if (cached) return cached;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      // ViaCEP é endpoint público; sem credenciais.
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro === true) {
      cepCache.set(cep, "not_found");
      return null;
    }
    const resolved: CepResolvedData = {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: (data.uf ?? "").toUpperCase(),
    };
    cepCache.set(cep, resolved);
    return resolved;
  } catch {
    return null;
  }
}

export function CepAutocompleteInput({
  id,
  value,
  onChangeValue,
  onResolved,
  onBlur,
  disabled,
}: CepAutocompleteInputProps) {
  const [loading, setLoading] = useState(false);
  const lastResolvedRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length !== 8) {
      setLoading(false);
      return;
    }
    // Evita refetch quando o caller acabou de chamar onResolved (que
    // pode setar outros campos e re-renderizar).
    if (lastResolvedRef.current === value) return;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const data = await fetchViaCep(value);
      setLoading(false);
      if (data) {
        lastResolvedRef.current = value;
        onResolved(data);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onResolved]);

  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        placeholder="65725000"
        maxLength={8}
        disabled={disabled}
        value={value}
        onChange={(e) =>
          onChangeValue(e.target.value.replace(/\D/g, "").slice(0, 8))
        }
        onBlur={onBlur}
        className="pr-9"
      />
      <span
        aria-hidden
        className="text-ink-4 pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2"
      >
        {loading ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <MapPinIcon className="size-4 opacity-60" aria-hidden />
        )}
      </span>
    </div>
  );
}
