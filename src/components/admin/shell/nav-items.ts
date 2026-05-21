// Estrutura de navegação do admin — Início + 4 grupos colapsáveis (accordion).
// soon:true → renderizado como disabled com badge "em breve" pelo sidebar-content.
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  BarChart2Icon,
  BookOpenIcon,
  Building2Icon,
  CalculatorIcon,
  ClockIcon,
  CreditCardIcon,
  FolderIcon,
  ImageIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  ListFilterIcon,
  type LucideIcon,
  PackageIcon,
  PaletteIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  ScanBarcodeIcon,
  ShoppingCartIcon,
  StoreIcon,
  TagIcon,
  TicketPercentIcon,
  TrendingUpIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
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

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    k: "operacao",
    label: "Operação",
    icon: ZapIcon,
    items: [
      { k: "pdv",      label: "Venda balcão",            icon: ScanBarcodeIcon,    href: "/admin/pdv",       exact: true },
      { k: "caixa",    label: "Caixa do dia",            icon: WalletIcon,         href: "/admin/pdv/caixa"             },
      { k: "vendas",   label: "Vendas",                  icon: ReceiptIcon,        href: "/admin/pedidos"               },
      { k: "estoque",  label: "Movimentação de estoque", icon: ArrowLeftRightIcon, href: "/admin/estoque",   exact: true },
      { k: "receber",  label: "A receber",               icon: ClockIcon,          href: "/admin/financeiro/receber"    },
      { k: "contatos", label: "Recados do site",         icon: InboxIcon,          href: "/admin/contatos"              },
    ],
  },
  {
    k: "cadastros",
    label: "Cadastros",
    icon: BookOpenIcon,
    items: [
      { k: "produtos",       label: "Produtos",          icon: PackageIcon,    href: "/admin/produtos",       exact: true },
      { k: "categorias",     label: "Categorias",        icon: FolderIcon,     href: "/admin/categorias"                  },
      { k: "marcas",         label: "Marcas",            icon: TagIcon,        href: "/admin/marcas"                      },
      { k: "clientes",       label: "Clientes",          icon: UsersIcon,      href: "/admin/clientes",       exact: true },
      { k: "grupos-cliente", label: "Grupos de cliente", icon: UsersRoundIcon, href: "/admin/clientes/grupos"             },
      { k: "fornecedores",   label: "Fornecedores",      icon: TruckIcon,      href: "/admin/fornecedores"                },
    ],
  },
  {
    k: "gestao",
    label: "Gestão",
    icon: TrendingUpIcon,
    items: [
      { k: "relatorios",    label: "Relatórios",     icon: BarChart2Icon,     href: "/admin/relatorios"        },
      { k: "estoque-baixo", label: "Estoque baixo",  icon: AlertTriangleIcon, href: "/admin/estoque/relatorio" },
      { k: "compras",       label: "Compras",        icon: ShoppingCartIcon,  href: "/admin/compras"           },
      { k: "custos",        label: "Custo & margem", icon: CalculatorIcon,    href: "/admin/produtos/custos"   },
    ],
  },
  {
    k: "loja-config",
    label: "Loja online + Configurações",
    icon: StoreIcon,
    items: [
      { k: "aparencia",  label: "Aparência",           icon: PaletteIcon,       href: "/admin/aparencia"        },
      { k: "banners",    label: "Banners",             icon: ImageIcon,         href: "/admin/banners"          },
      { k: "vitrines",   label: "Vitrines",            icon: LayoutGridIcon,    href: "/admin/colecoes"         },
      { k: "filtros",    label: "Filtros da loja",     icon: ListFilterIcon,    href: "/admin/atributos"        },
      { k: "cupons",     label: "Códigos de desconto", icon: TicketPercentIcon, href: "/admin/promocoes/cupons" },
      { k: "pagamento",  label: "Formas de pagamento", icon: CreditCardIcon,    href: "/admin/pagamento"        },
      { k: "equipe",     label: "Equipe",              icon: UserCogIcon,       href: "/admin/equipe"           },
      { k: "dados-loja", label: "Dados da loja",       icon: Building2Icon,     href: "/admin/configuracoes"    },
      { k: "assinatura", label: "Plano e assinatura",  icon: ReceiptTextIcon,   href: "/admin/assinatura"       },
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

/** Acha se um item está ativo (link direto ou algum sub). */
export function isItemActive(item: AdminNavItem, pathname: string): boolean {
  if (item.href) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }
  if (item.subs) {
    return item.subs.some((s) => isSubItemActive(s, pathname));
  }
  return false;
}

/**
 * Acha qual seção (operacao/cadastros/gestao/loja-config) contém o pathname.
 * Usado pra abrir o accordion correto ao entrar na rota.
 * Retorna null se nenhuma seção bater (ex: rota /admin é o Início standalone).
 */
export function findActiveSectionKey(pathname: string): string | null {
  for (const section of ADMIN_NAV_SECTIONS) {
    if (section.items.some((item) => isItemActive(item, pathname))) {
      return section.k;
    }
  }
  return null;
}
