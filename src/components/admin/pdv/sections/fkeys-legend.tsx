/**
 * FKeysLegend — atalhos do PDV no rodapé. Extraído de pdv-shell.tsx
 * em S4.1 (refactor 3409 → menor).
 *
 * Static — sem props, sem state. Lista de F-keys que pdv-shell.tsx
 * implementa via listener global em useEffect.
 */
export function FKeysLegend() {
  const keys: Array<{ key: string; label: string }> = [
    { key: "F2", label: "Buscar produto" },
    { key: "F3", label: "Buscar cliente" },
    { key: "F4", label: "Finalizar venda" },
    { key: "F8", label: "Busca avançada" },
    { key: "F9", label: "Desconto manual" },
    { key: "ESC", label: "Limpar venda" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-4 lg:px-1">
      {keys.map((k) => (
        <span key={k.key} className="inline-flex items-center gap-1.5">
          <kbd className="mono inline-block rounded border border-line bg-bg-app px-1.5 py-[1px] text-[10.5px] font-semibold text-ink-2">
            {k.key}
          </kbd>
          <span>{k.label}</span>
        </span>
      ))}
    </div>
  );
}
