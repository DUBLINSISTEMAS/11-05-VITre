// LojaOnlineSnapshot — Bloco F.2.4 (2026-05-28), gate L6 (2026-05-29).
//
// Linha COMPACTA no rodapé do dashboard mostrando estado da loja online.
// Cada item linkável pra rota de resolução.
//
// Onda L6 (2026-05-29) — gate de visibilidade: quando a loja NAO tem
// produto publicado, esconde o bloco inteiro. Lojista que so vende
// balcao+WhatsApp nao precisa ver "Nenhum produto publicado" perpetuo
// poluindo o dashboard. Mesma logica do opt-in da sidebar L5.
// Volta a aparecer assim que o primeiro produto for publicado.

import {
  CameraOffIcon,
  ExternalLinkIcon,
  PackageIcon,
} from "lucide-react";
import Link from "next/link";

import type { DashboardLojaOnline } from "@/actions/dashboard/load-kpis";

interface LojaOnlineSnapshotProps {
  data: DashboardLojaOnline;
}

export function LojaOnlineSnapshot({ data }: LojaOnlineSnapshotProps) {
  // Gate L6 — esconde quando nao ha storefront ativo (zero publicados,
  // zero sem foto). Bloco sumir e melhor que mostrar mensagem perpetua.
  if (data.produtosPublicados === 0 && data.produtosSemFoto === 0) {
    return null;
  }

  return (
    <section className="b3-loja-online" aria-label="Loja online">
      <h2 className="b3-loja-online-title">Loja online</h2>

      <ul className="b3-loja-online-list">
        {/* Bloco E2 UX (2026-05-29) — "Recados aguardando" MOVIDO daqui
            pra Pegando fogo (sinal de urgência). Antes ficava no rodapé,
            depois de 2 charts + tabela. Lojista BR responde WhatsApp
            antes do café — o item merecia destaque no triagem do dia. */}

        {data.produtosSemFoto > 0 ? (
          <SnapshotItem
            href="/admin/produtos?tipo=publico&semFoto=1"
            icon={<CameraOffIcon size={14} aria-hidden />}
            label={
              data.produtosSemFoto === 1
                ? "1 produto publicado sem foto"
                : `${data.produtosSemFoto} produtos publicados sem foto`
            }
            highlight
          />
        ) : null}

        <SnapshotItem
          href="/admin/produtos?tipo=publico"
          icon={<PackageIcon size={14} aria-hidden />}
          label={
            data.produtosPublicados === 0
              ? "Nenhum produto publicado"
              : data.produtosPublicados === 1
                ? "1 produto publicado"
                : `${data.produtosPublicados} produtos publicados`
          }
        />

        {/* Link pra loja online — abre em nova aba pq não está sob /admin */}
        <li>
          <a
            href={`/${data.storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="b3-loja-online-item b3-loja-online-item--external"
          >
            <ExternalLinkIcon size={13} aria-hidden />
            <span className="font-mono text-[11.5px]">
              vitre.site/{data.storeSlug}
            </span>
          </a>
        </li>
      </ul>
    </section>
  );
}

interface SnapshotItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  highlight?: boolean;
}

function SnapshotItem({ href, icon, label, highlight }: SnapshotItemProps) {
  return (
    <li>
      <Link
        href={href}
        prefetch
        className={
          highlight
            ? "b3-loja-online-item b3-loja-online-item--highlight"
            : "b3-loja-online-item"
        }
      >
        {icon}
        <span>{label}</span>
      </Link>
    </li>
  );
}
