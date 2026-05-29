// Estrutura de navegação do admin — Início + 4 grupos colapsáveis (accordion).
// soon:true → renderizado como disabled com badge "em breve" pelo sidebar-content.
import {
  ArrowLeftRightIcon,
  BarChart2Icon,
  BookOpenIcon,
  Building2Icon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  type LucideIcon,
  PackageIcon,
  PaletteIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TicketPercentIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  ZapIcon,
} from "lucide-react";

export interface AdminNavSubItem {
  label: string;
  href: string;
  soon?: boolean;
}

export interface AdminNavItem {
  k: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  exact?: boolean;
  subs?: AdminNavSubItem[];
  dot?: boolean;
  soon?: boolean;
}

export interface AdminNavSection {
  k: string;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
}

/**
 * Item "Início" — sempre visível no topo, fora do accordion.
 * Decisão founder 2026-05-21: o dashboard é o ponto de aterrissagem padrão
 * do lojista, então não fica enterrado num grupo recolhível.
 */
export const ADMIN_NAV_HOME: AdminNavItem = {
  k: "inicio",
  label: "Início",
  icon: LayoutDashboardIcon,
  href: "/admin",
  exact: true,
};

// Onda L1 (2026-05-29) — sidebar minimalista. Founder reportou
// "feio, sem logica, polui o dia-a-dia" no estado anterior (4 grupos,
// ~25 itens, vocabulario inconsistente). Regra "funciona ou esconde"
// aplicada com forca: cada item exposto ENTREGA fluxo ponta-a-ponta.
//
// Escondidos da nav (rotas seguem vivas por URL pra deep-link e fallback):
//   /admin/contatos          — Recados do site (feature morta, removida da UI)
//   /admin/produtos/custos   — duplicava /admin/produtos (custo ja vive la)
//   /admin/estoque/parado    — tab interna de /admin/estoque (planejado)
//   /admin/estoque/vencendo  — tab interna de /admin/estoque (planejado)
//   /admin/clientes/grupos   — tab interna de /admin/clientes (planejado)
//   /admin/equipe            — RBAC nao chegou (storeMembership pendente)
//   /admin/assinatura        — Stripe nao integrado
//
// Estrutura: Inicio + 4 grupos (Operacao, Cadastros, Gestao, Loja online).
// Total: 17 itens visiveis vs 25 anteriores.
export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    k: "operacao",
    label: "Operação",
    icon: ZapIcon,
    items: [
      { k: "vendas",     label: "Vendas",         icon: ReceiptIcon,        href: "/admin/pedidos"            },
      { k: "orcamentos", label: "Orçamentos",     icon: FileTextIcon,       href: "/admin/orcamentos"         },
      { k: "caixa",      label: "Caixa do dia",   icon: WalletIcon,         href: "/admin/pdv/caixa"          },
      { k: "estoque",    label: "Estoque",        icon: ArrowLeftRightIcon, href: "/admin/estoque", exact: true },
      { k: "receber",    label: "A receber",      icon: ClockIcon,          href: "/admin/financeiro/receber" },
      { k: "pagar",      label: "A pagar",        icon: ClockIcon,          href: "/admin/financeiro/pagar"   },
    ],
  },
  {
    k: "cadastros",
    label: "Cadastros",
    icon: BookOpenIcon,
    items: [
      { k: "produtos",     label: "Produtos",     icon: PackageIcon, href: "/admin/produtos",     exact: true },
      { k: "clientes",     label: "Clientes",     icon: UsersIcon,   href: "/admin/clientes",     exact: true },
      { k: "categorias",   label: "Categorias",   icon: FolderIcon,  href: "/admin/categorias"                },
      { k: "marcas",       label: "Marcas",       icon: TagIcon,     href: "/admin/marcas"                    },
      { k: "fornecedores", label: "Fornecedores", icon: TruckIcon,   href: "/admin/fornecedores"              },
    ],
  },
  {
    k: "gestao",
    label: "Gestão",
    icon: TrendingUpIcon,
    items: [
      { k: "resultado",  label: "Resultado",  icon: TrendingUpIcon,   href: "/admin/relatorios/resultado" },
      { k: "relatorios", label: "Relatórios", icon: BarChart2Icon,    href: "/admin/relatorios"           },
      { k: "compras",    label: "Compras",    icon: ShoppingCartIcon, href: "/admin/compras"              },
    ],
  },
  {
    k: "loja-config",
    label: "Loja online",
    icon: StoreIcon,
    items: [
      { k: "aparencia",  label: "Aparência",           icon: PaletteIcon,       href: "/admin/aparencia"        },
      { k: "banners",    label: "Banners",             icon: ImageIcon,         href: "/admin/banners"          },
      { k: "vitrines",   label: "Vitrines",            icon: LayoutGridIcon,    href: "/admin/colecoes"         },
      { k: "cupons",     label: "Códigos de desconto", icon: TicketPercentIcon, href: "/admin/promocoes/cupons" },
      { k: "pagamento",  label: "Formas de pagamento", icon: CreditCardIcon,    href: "/admin/pagamento"        },
      { k: "dados-loja", label: "Dados da loja",       icon: Building2Icon,     href: "/admin/configuracoes"    },
    ],
  },
] as const;

/**
 * Item de suporte — exportado separadamente para render como link discreto
 * no footer da sidebar, abaixo dos grupos e acima do user card.
 */
export const ADMIN_NAV_SUPPORT: AdminNavItem = {
  k: "suporte",
  label: "Suporte",
  icon: LifeBuoyIcon,
  href: "/admin/suporte",
};

/** Acha se um sub-item está ativo dado o pathname atual. */
export function isSubItemActive(sub: AdminNavSubItem, pathname: string): boolean {
  return pathname === sub.href || pathname.startsWith(sub.href + "/");
}

/**
 * Match teste para 1 item de menu — sem desempate longest-prefix.
 * `pickActiveItemKey` cuida do desempate quando há vários candidatos.
 */
function matchesItem(item: AdminNavItem, pathname: string): boolean {
  if (item.href) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }
  if (item.subs) {
    return item.subs.some((s) => isSubItemActive(s, pathname));
  }
  return false;
}

/**
 * Audit 2026-05-28 — fix do "tudo verde": dado pathname e um escopo de items,
 * devolve o `k` do item com HREF MAIS LONGO que matcha. Sem isto, quando
 * lojista entra em /admin/relatorios/resultado, tanto "Relatórios"
 * (/admin/relatorios) quanto "Resultado" ficam com data-active=true →
 * CSS verde em ambos. Mesma falha em Estoque/Estoque parado/vencendo.
 */
export function pickActiveItemKey(
  pathname: string,
  items: readonly AdminNavItem[],
): string | null {
  let bestK: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    if (!matchesItem(item, pathname)) continue;
    const len = item.href ? item.href.length : 0;
    if (len > bestLen) {
      bestK = item.k;
      bestLen = len;
    }
  }
  return bestK;
}

/**
 * Acha se um item está ativo (link direto ou algum sub).
 * Com `scope`: aplica longest-match (item só é ativo se for o mais específico).
 * Sem `scope`: comportamento legado (qualquer match conta).
 */
export function isItemActive(
  item: AdminNavItem,
  pathname: string,
  scope?: readonly AdminNavItem[],
): boolean {
  if (scope) return pickActiveItemKey(pathname, scope) === item.k;
  return matchesItem(item, pathname);
}

/** Concatena Início + items de todas as seções + Suporte. Usado como scope
 *  do longest-match na sidebar. */
export function getAllNavItems(): readonly AdminNavItem[] {
  const all: AdminNavItem[] = [ADMIN_NAV_HOME];
  for (const section of ADMIN_NAV_SECTIONS) all.push(...section.items);
  all.push(ADMIN_NAV_SUPPORT);
  return all;
}

/**
 * Acha qual seção (operacao/cadastros/gestao/loja-config) contém o pathname.
 * Usado pra abrir o accordion correto ao entrar na rota.
 * Retorna null se nenhuma seção bater (ex: rota /admin é o Início standalone).
 */
export function findActiveSectionKey(pathname: string): string | null {
  for (const section of ADMIN_NAV_SECTIONS) {
    if (section.items.some((item) => matchesItem(item, pathname))) {
      return section.k;
    }
  }
  return null;
}
