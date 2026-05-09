"use client";

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { checkSlugAvailability } from "@/actions/store/check-slug-availability";
import { Input } from "@/components/ui/input";
import { isReservedSlug, isValidSlugFormat } from "@/lib/slug";
import { cn } from "@/lib/utils";

interface SlugInputProps {
  value: string;
  onChange: (value: string) => void;
  onAvailabilityChange?: (available: boolean) => void;
  disabled?: boolean;
  appUrl: string; // ex: "vitre-app.vercel.app"
}

type Status =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "format" }
  | { kind: "reserved" }
  | { kind: "taken" }
  | { kind: "throttled" }
  | { kind: "error" };

/**
 * Input de slug com:
 * - Prefixo visual `vitre.app/`
 * - Sanitização ao digitar (lowercase, sem espaço, hífen)
 * - Debounced check de disponibilidade no servidor (500ms)
 * - Last-request-wins (cancela checks anteriores)
 */
export function SlugInput({
  value,
  onChange,
  onAvailabilityChange,
  disabled,
  appUrl,
}: SlugInputProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const checkSeq = useRef(0);

  useEffect(() => {
    onAvailabilityChange?.(status.kind === "ok");
  }, [status, onAvailabilityChange]);

  useEffect(() => {
    if (!value) {
      setStatus({ kind: "idle" });
      return;
    }
    if (!isValidSlugFormat(value)) {
      setStatus({ kind: "format" });
      return;
    }
    if (isReservedSlug(value)) {
      setStatus({ kind: "reserved" });
      return;
    }

    setStatus({ kind: "checking" });
    const mySeq = ++checkSeq.current;

    const t = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability({ slug: value });
        if (mySeq !== checkSeq.current) return; // request mais recente em vôo
        if (result.available) {
          setStatus({ kind: "ok" });
        } else {
          setStatus({ kind: result.reason });
        }
      } catch {
        if (mySeq === checkSeq.current) setStatus({ kind: "error" });
      }
    }, 500);

    return () => clearTimeout(t);
  }, [value]);

  const sanitize = (raw: string): string =>
    raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);

  return (
    <div className="space-y-1.5">
      <div className="border-input flex items-center overflow-hidden rounded-md border focus-within:ring-ring/50 focus-within:ring-[3px] focus-within:border-ring">
        <span className="text-muted-foreground bg-muted/40 border-input border-r px-3 py-2 text-sm whitespace-nowrap">
          {appUrl}/
        </span>
        <Input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="sandra-brito"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(sanitize(e.target.value))}
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <div className="px-3 text-sm" aria-live="polite">
          {status.kind === "checking" && (
            <Loader2Icon className="text-muted-foreground size-4 animate-spin" aria-label="Verificando" />
          )}
          {status.kind === "ok" && (
            <CheckIcon className="size-4 text-emerald-600" aria-label="Disponível" />
          )}
          {(status.kind === "format" ||
            status.kind === "reserved" ||
            status.kind === "taken" ||
            status.kind === "throttled" ||
            status.kind === "error") && (
            <XIcon className="text-destructive size-4" aria-label="Indisponível" />
          )}
        </div>
      </div>
      <p
        className={cn(
          "text-xs",
          status.kind === "ok" ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {labelFor(status)}
      </p>
    </div>
  );
}

function labelFor(s: Status): string {
  switch (s.kind) {
    case "idle":
      return "Use letras minúsculas, números e hífen. Ex: sandra-brito";
    case "checking":
      return "Verificando disponibilidade...";
    case "ok":
      return "Disponível ✓";
    case "format":
      return "Use 3-40 caracteres: a-z, 0-9 e hífen.";
    case "reserved":
      return "Esse endereço é reservado. Escolha outro.";
    case "taken":
      return "Já existe uma loja com esse endereço.";
    case "throttled":
      return "Muitas verificações. Aguarde um momento.";
    case "error":
      return "Não conseguimos verificar agora. Tente novamente.";
  }
}
