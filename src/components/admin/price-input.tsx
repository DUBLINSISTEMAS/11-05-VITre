"use client";

import { NumericFormat } from "react-number-format";

import { Input } from "@/components/ui/input";

interface PriceInputProps {
  /** Valor em CENTAVOS (8990 = R$ 89,90). null = vazio. */
  value: number | null;
  /** Recebe o novo valor em centavos, ou null se vazio. */
  onChange: (value: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  "aria-invalid"?: boolean;
}

/**
 * Input de preço com máscara BRL (R$ 1.234,56).
 *
 * - Internamente armazena CENTAVOS (number).
 * - `Math.round(floatValue * 100)` evita imprecisão de FP (8990.0000001).
 * - inputmode="decimal" → teclado numérico no celular.
 */
export function PriceInput({
  value,
  onChange,
  disabled,
  placeholder,
  id,
  ...rest
}: PriceInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      type="text"
      inputMode="decimal"
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      prefix="R$ "
      placeholder={placeholder ?? "R$ 0,00"}
      disabled={disabled}
      id={id}
      value={value !== null ? value / 100 : ""}
      onValueChange={(v) => {
        if (v.floatValue === undefined || v.floatValue === null) {
          onChange(null);
        } else {
          onChange(Math.round(v.floatValue * 100));
        }
      }}
      aria-invalid={rest["aria-invalid"]}
    />
  );
}
