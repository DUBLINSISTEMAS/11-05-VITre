/**
 * FieldText — input rotulado pra QuickSaleDialog + FullCustomerCreateDialog.
 * Extraído de pdv-shell.tsx em S4.1.
 *
 * Usa forwardRef pra dialogs focarem input específico após validação.
 */
import { forwardRef } from "react";

export const FieldText = forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    required?: boolean;
    type?: string;
  }
>(function FieldText(
  { label, value, onChange, placeholder, error, required, type = "text" },
  ref,
) {
  return (
    <div>
      <label className="text-ink-2 mb-1 block text-[12px] font-medium">
        {label}
      </label>
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`bg-surface h-10 w-full rounded-[8px] border px-3 text-[13px] outline-none ${
          error ? "border-red-500" : "border-line focus:border-brand"
        }`}
      />
      {error && (
        <p className="mt-1 text-[10.5px] text-red-600">{error}</p>
      )}
    </div>
  );
});
