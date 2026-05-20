"use client";

/**
 * BarcodeLabel — Sprint 2E.
 *
 * Renderiza uma etiqueta de produto com código de barras em SVG.
 * Auto-detecta formato baseado no valor:
 *   - 13 dígitos → EAN-13
 *   - 8 dígitos → EAN-8
 *   - 12 dígitos → UPC-A
 *   - 14 dígitos → ITF-14 (DUN)
 *   - Outro → CODE128 (genérico — aceita letras + dígitos)
 *
 * Tamanho fixo por chamada (lojista escolhe A4 ou térmica 80mm no page parent).
 */
import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

import { formatBRL } from "@/lib/pricing";

interface BarcodeLabelProps {
  /** Valor a codificar. Geralmente product.gtin OU product.internalCode OU product.id slice. */
  value: string;
  productName: string;
  priceInCents: number;
  storeName?: string;
  /** Largura total da etiqueta em mm. 80 = térmica, 50 = pequena, 100 = média. */
  widthMm?: number;
  /** Altura do código de barras em pixels (apenas o barcode, não a etiqueta inteira). */
  barcodeHeight?: number;
  /** Formato manual (override do auto-detect). */
  format?: "EAN13" | "EAN8" | "UPC" | "ITF14" | "CODE128";
}

function detectFormat(value: string): BarcodeLabelProps["format"] {
  const digitsOnly = /^\d+$/.test(value);
  if (digitsOnly) {
    if (value.length === 13) return "EAN13";
    if (value.length === 8) return "EAN8";
    if (value.length === 12) return "UPC";
    if (value.length === 14) return "ITF14";
  }
  return "CODE128";
}

export function BarcodeLabel({
  value,
  productName,
  priceInCents,
  storeName,
  widthMm = 80,
  barcodeHeight = 50,
  format,
}: BarcodeLabelProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const detected = format ?? detectFormat(value);
    try {
      JsBarcode(svgRef.current, value, {
        format: detected,
        height: barcodeHeight,
        margin: 0,
        marginTop: 4,
        marginBottom: 4,
        displayValue: true,
        fontSize: 12,
        textMargin: 2,
        // CODE128 não tem checksum required; EAN/UPC/ITF têm — JsBarcode valida
        // internamente e lança se inválido. Usamos try/catch pra cair pra CODE128.
      });
    } catch {
      // Fallback: render como CODE128 (aceita praticamente qualquer string).
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          height: barcodeHeight,
          margin: 0,
          marginTop: 4,
          marginBottom: 4,
          displayValue: true,
          fontSize: 12,
          textMargin: 2,
        });
      } catch {
        // Se nem CODE128 aceita (string vazia, por exemplo), esvazia o SVG.
        if (svgRef.current) svgRef.current.innerHTML = "";
      }
    }
  }, [value, format, barcodeHeight]);

  return (
    <div
      className="bg-white text-black"
      style={{
        width: `${widthMm}mm`,
        padding: "2mm",
        border: "0.25mm solid #000",
        borderRadius: "1mm",
        display: "flex",
        flexDirection: "column",
        gap: "1mm",
        // Garante que dentro do print fique preto puro
        printColorAdjust: "exact",
      }}
    >
      {storeName ? (
        <div
          style={{
            fontSize: "8pt",
            fontWeight: 600,
            textAlign: "center",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          {storeName}
        </div>
      ) : null}
      <div
        style={{
          fontSize: "9pt",
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.2,
          // Trunca nomes longos pra não estourar etiqueta pequena
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {productName}
      </div>
      <svg ref={svgRef} style={{ width: "100%", height: "auto" }} />
      <div
        style={{
          fontSize: "11pt",
          fontWeight: 700,
          textAlign: "center",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {formatBRL(priceInCents)}
      </div>
    </div>
  );
}
