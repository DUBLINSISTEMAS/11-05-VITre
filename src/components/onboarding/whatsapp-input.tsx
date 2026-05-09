"use client";

import { PatternFormat } from "react-number-format";

import { Input } from "@/components/ui/input";

interface WhatsAppInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
}

/**
 * Máscara BR `(##) #####-####`. Envia ao parent o número sem máscara
 * (apenas dígitos), pronto para `parseWhatsAppBR` validar via libphonenumber-js.
 */
export function WhatsAppInput({
  value,
  onChange,
  disabled,
  id,
  ...rest
}: WhatsAppInputProps) {
  return (
    <PatternFormat
      format="(##) #####-####"
      mask="_"
      customInput={Input}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(11) 99999-9999"
      id={id}
      disabled={disabled}
      value={value}
      onValueChange={(v) => onChange(v.value)}
      aria-invalid={rest["aria-invalid"]}
    />
  );
}
