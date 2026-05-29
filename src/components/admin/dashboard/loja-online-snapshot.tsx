// LojaOnlineSnapshot — Bloco F.2.4 da ressignificação (2026-05-28).
//
// Linha COMPACTA no rodapé do dashboard mostrando estado da loja online
// pra responder a pergunta-mãe #7: "Como tá indo a loja online?".
//
// Conselho 2026-05-28: lojista NÃO QUER analytics genérico (visitas,
// conversão — fora do escopo F sem Plausible). Quer saber o ACIONÁVEL:
//   1. Tem recado WhatsApp aguardando contato? (urgente)
//   2. Tem produto publicado que não tem foto? (vergonhoso)
//   3. Quantos produtos estão na vitrine? (saúde do catálogo)
//   4. Qual o endereço da minha loja? (acessar rápido)
//
// Layout horizontal denso. Cada item linkável pra rota de resolução.

import {
  CameraOffIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
  PackageIcon,
} from "lucide-react";
import Link from "next/link";

import type { DashboardLojaOnline } from "@/actions/dashboard/load-kpis";

interface LojaOnlineSnapshotProps {
  data: DashboardLojaOnline;
}

export function LojaOnlineSnapshot({ data }: LojaOnlineSnapshotProps) {
  return (
    <section className="b3-loja-online" aria-label="Loja online">
      <h2 className="b3-loja-online-title">Loja online</h2>

      <ul className="b3-loja-online-list">
        <SnapshotItem
          href="/admin/contatos"
          icon={<MessageCircleIcon size={14} aria-hidden />}
          label={
            data.recadosPendentes === 0
              ? "Sem recados aguardando"
              : data.recadosPendentes === 1
                ? "1 recado aguardando contato"
                : `${data.recadosPendentes} recados aguardando contato`
          }
          highlight={data.recadosPendentes > 0}
        />

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
