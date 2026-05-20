"use client";

import { ChevronLeftIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BarcodeLabel } from "@/components/admin/barcode-label";

interface BarcodeEtiquetaClientProps {
  productId: string;
  productName: string;
  priceInCents: number;
  barcodeValue: string;
  hasGtin: boolean;
  hasInternalCode: boolean;
  storeName: string;
}

type LayoutMode = "thermal-80mm" | "a4-grid";

export function BarcodeEtiquetaClient({
  productId,
  productName,
  priceInCents,
  barcodeValue,
  hasGtin,
  hasInternalCode,
  storeName,
}: BarcodeEtiquetaClientProps) {
  const [copies, setCopies] = useState(1);
  const [layout, setLayout] = useState<LayoutMode>("thermal-80mm");
  const [includeStore, setIncludeStore] = useState(true);

  function handlePrint() {
    window.print();
  }

  // Gera array de etiquetas baseado em quantidade
  const labels = Array.from({ length: Math.max(1, Math.min(100, copies)) });

  const sourceLabel = hasGtin
    ? "GTIN do produto"
    : hasInternalCode
      ? "Código interno"
      : "ID interno (CODE128 fallback)";

  return (
    <>
      {/*
        CSS print: oculta layout do admin (header/sidebar/bottom nav)
        e ajusta margens da página. Inline porque é específico desta rota.
      */}
      <style>{`
        @media print {
          @page { margin: 8mm; size: ${layout === "a4-grid" ? "A4" : "80mm auto"}; }
          html, body { background: white !important; color: black !important; }
          [data-admin-chrome] { display: none !important; }
          .etiqueta-controls { display: none !important; }
          .etiqueta-print-area {
            padding: 0 !important;
            background: white !important;
          }
          .etiqueta-grid {
            gap: ${layout === "a4-grid" ? "3mm" : "0"} !important;
          }
        }
      `}</style>

      <div className="space-y-4 sm:space-y-6">
        {/* Controles (escondidos na impressão) */}
        <div className="etiqueta-controls space-y-4">
          <div className="flex items-start gap-3">
            <Link
              href={`/admin/produtos/${productId}`}
              aria-label="Voltar para o produto"
              className="b3-btn b3-btn--sm size-9 shrink-0 justify-center p-0"
            >
              <ChevronLeftIcon size={15} />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
                Etiqueta com código de barras
              </h1>
              <p className="text-ink-4 mt-1 text-[13px]">
                {productName} · valor codificado: <span className="mono">{barcodeValue}</span>{" "}
                ({sourceLabel})
              </p>
            </div>
          </div>

          <div className="b3-card b3-card-pad space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="etq-copies"
                  className="text-ink-2 block text-[12.5px] font-medium"
                >
                  Quantidade de etiquetas
                </label>
                <input
                  id="etq-copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  step={1}
                  value={copies}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) setCopies(n);
                  }}
                  className="b3-input mono w-full"
                />
                <p className="text-ink-4 text-[11px]">Máximo 100 por vez.</p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="etq-layout"
                  className="text-ink-2 block text-[12.5px] font-medium"
                >
                  Formato
                </label>
                <select
                  id="etq-layout"
                  className="b3-input w-full"
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as LayoutMode)}
                >
                  <option value="thermal-80mm">Térmica 80mm (1 por linha)</option>
                  <option value="a4-grid">A4 (grid 2 colunas)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-ink-2 block text-[12.5px] font-medium">
                  Opções
                </label>
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={includeStore}
                    onChange={(e) => setIncludeStore(e.target.checked)}
                    className="b3-checkbox-box"
                  />
                  <span>Mostrar nome da loja no topo</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handlePrint}
                className="b3-btn b3-btn--cta gap-2"
              >
                <PrinterIcon size={14} />
                Imprimir
              </button>
            </div>
          </div>
        </div>

        {/* Preview / Print area */}
        <div className="etiqueta-print-area p-4">
          <div
            className={
              layout === "a4-grid"
                ? "etiqueta-grid grid grid-cols-2 gap-3"
                : "etiqueta-grid flex flex-col items-center gap-1"
            }
          >
            {labels.map((_, idx) => (
              <BarcodeLabel
                key={idx}
                value={barcodeValue}
                productName={productName}
                priceInCents={priceInCents}
                storeName={includeStore ? storeName : undefined}
                widthMm={layout === "a4-grid" ? 95 : 80}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
