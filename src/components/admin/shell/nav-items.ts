// Estrutura de navegação do admin — 4 grupos canônicos (Sprint 0, CLAUDE.md).
// Todos os itens são flat (sem sub-itens recolhíveis).
// soon:true → renderizado como disabled com badge "em breve" pelo sidebar-content.
import {
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  BarChart2Icon,
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
  TagIcon,
  TicketPercentIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
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
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { k: "inicio",   label: "Início",                  icon: LayoutDashboardIcon, href: "/admin",           exact: true },
      { k: "pdv",      label: "Venda balcão",            icon: ScanBarcodeIcon,     href: "/admin/pdv",       exact: true },
      { k: "caixa",    label: "Caixa do dia",            icon: WalletIcon,          href: "/admin/pdv/caixa"             },
      { k: "vendas",   label: "Vendas",                  icon: ReceiptIcon,         href: "/admin/pedidos"               },
      { k: "estoque",  label: "Movimentação de estoque", icon: ArrowLeftRightIcon,  href: "/admin/estoque",   exact: true },
      { k: "receber",  label: "A receber",               icon: ClockIcon,           soon: true                           },
      { k: "contatos", label: "Recados do site",         icon: InboxIcon,           href: "/admin/contatos"              },
    ],
  },
  {
    label: "CADASTROS",
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
    label: "GESTÃO",
    items: [
      { k: "relatorios",    label: "Relatórios",    icon: BarChart2Icon,     href: "/admin/relatorios"        },
      { k: "estoque-baixo", label: "Estoque baixo", icon: AlertTriangleIcon, href: "/admin/estoque/relatorio" },
      { k: "compras",       label: "Compras",       icon: ShoppingCartIcon,  soon: true                       },
      { k: "custos",        label: "Custo & margem",icon: CalculatorIcon,    href: "/admin/produtos/custos"   },
    ],
  },
  {
    label: "LOJA ONLINE + CONFIGURAÇÕES",
    items: [
      { k: "aparencia",  label: "Aparência",          icon: PaletteIcon,       href: "/admin/aparencia"        },
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
 * no footer da sidebar, abaixo dos 4 grupos e acima do user card.
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
