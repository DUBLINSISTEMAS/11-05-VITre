/**
 * CollectionStrip — Sprint 5.3 (2026-05-22), redesign PP5 (handoff
 * pixel-perfect 2026-05-25).
 *
 * Seção "Vitrines" na home da loja. PP5 reescreve os tiles compactos
 * (140px com thumbnail) em **cards coloridos largos** que batem
 * `vt-vitrine-card` do handoff (home.jsx linha 60).
 *
 * Cada card mostra:
 *   - kicker (label pequena em cima, ex: "Top semana") — opcional
 *   - title (nome da vitrine)
 *   - meta (count produtos · description curta)
 *
 * Background usa `bgColor` da vitrine (admin escolhe) com fallback
 * cinza neutro. Quando `bgColor` é hex escuro/médio, texto fica branco
 * com leve transparência; quando claro/null, texto verde Mangos.
 */
import Link from "next/link";

import type { HomeCollection } from "@/lib/storefront/home-loader";

interface CollectionStripProps {
  storeSlug: string;
  collections: HomeCollection[];
}

/**
 * Heurística de contraste: dado um hex `#rrggbb` (ou `#rgb`), decide se
 * o texto deve ser claro (sobre fundo escuro) ou escuro. Computa
 * luminância YIQ — mesma fórmula que W3C recomenda pra contraste de
 * leitura. Threshold 145 (de 255) calibrado pros gradientes do handoff.
 */
function shouldUseLightText(bgHex: string | null): boolean {
  if (!bgHex) return false;
  const hex = bgHex.replace("#", "");
  const expand = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (expand.length !== 6) return false;
  const r = parseInt(expand.slice(0, 2), 16);
  const g = parseInt(expand.slice(2, 4), 16);
  const b = parseInt(expand.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 145;
}

export function CollectionStrip({ storeSlug, collections }: CollectionStripProps) {
  if (collections.length === 0) return null;

  return (
    <div
      className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-label="Vitrines da loja"
    >
      <ul className="flex gap-3" role="list">
        {collections.map((c) => {
          const light = shouldUseLightText(c.bgColor);
          const fallback = c.bgColor === null;
          return (
            <li key={c.id} className="shrink-0">
              <Link
                href={`/${storeSlug}/colecao/${c.slug}`}
                prefetch={false}
                className="group flex h-[130px] w-[280px] flex-col justify-between overflow-hidden rounded-[14px] p-4 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  background: c.bgColor ?? "var(--bg-app)",
                  border: fallback ? "1px solid var(--line)" : "none",
                  color: light
                    ? "rgba(255,255,255,0.95)"
                    : fallback
                      ? "var(--ink-1)"
                      : "var(--mangos-green-950)",
                }}
              >
                {c.kicker ? (
                  <span
                    className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em]"
                    style={{ opacity: light ? 0.8 : 0.7 }}
                  >
                    {c.kicker}
                  </span>
                ) : (
                  <span />
                )}
                <div className="space-y-0.5">
                  <h3 className="text-[18px] font-bold leading-tight tracking-tight line-clamp-2">
                    {c.name}
                  </h3>
                  <p
                    className="text-[11.5px]"
                    style={{ opacity: light ? 0.75 : 0.65 }}
                  >
                    {c.productCount}{" "}
                    {c.productCount === 1 ? "peça" : "peças"}
                    {c.description ? ` · ${c.description.slice(0, 40)}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
