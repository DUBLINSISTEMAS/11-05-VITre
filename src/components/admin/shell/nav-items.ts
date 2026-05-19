// Estrutura de navegação do admin — Port Dublin v3 (ADR-0019 reabertura, Onda A.3).
//
// Estabilização P0/P1 (2026-05-19): a sidebar só expõe módulos operacionais.
// Módulos rasos/placeholder ficam ocultos até terem fluxo maduro, evitando
// comunicar “sistema em obra” para o lojista.
import {
  BoxesIcon,
  CreditCardIcon,
  HomeIcon,
  type LucideIcon,
  PackageIcon,
  PaletteIcon,
  ShoppingCartIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";

export interface AdminNavSubItem {
  label: string;
  href: string;
  /** Módulo ainda não exposto na estabilização P0/P1. Mantido para compatibilidade do renderer. */
  soon?: boolean;
}

export interface AdminNavItem {
  /** Slug interno usado pra controlar estado "open" do sub. */
  k: string;
  label: string;
  icon: LucideIcon;
  /** Link direto (item sem sub). */
  href?: string;
  /** Match exato pra rotas raiz (ex: "/admin"). */
  exact?: boolean;
  /** Sub-itens recolhíveis. Quando presente, ignora `href` no header. */
  subs?: AdminNavSubItem[];
  /** Bolinha indicadora opcional. Mantida no tipo porque o renderer suporta. */
  dot?: boolean;
  /** Módulo ainda não exposto na estabilização P0/P1. Mantido para compatibilidade do renderer. */
  soon?: boolean;
}

export interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = [
  {
    label: "CONTROLE INTERNO",
    items: [
      { k: "painel", label: "Painel", icon: HomeIcon, href: "/admin", exact: true },
      {
        k: "produtos",
        label: "Produtos",
        icon: PackageIcon,
        subs: [
          { label: "Meus produtos", href: "/admin/produtos" },
          { label: "Categorias", href: "/admin/categorias" },
          { label: "Banners", href: "/admin/banners" },
        ],
      },
      { k: "estoque", label: "Estoque", icon: BoxesIcon, href: "/admin/estoque" },
      {
        k: "clientes",
        label: "Clientes",
        icon: UsersIcon,
        subs: [{ label: "Meus clientes", href: "/admin/clientes" }],
      },
      {
        k: "vendas",
        label: "Vendas",
        icon: ShoppingCartIcon,
        subs: [
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: "PDV", href: "/admin/pdv" },
          { label: "Caixa", href: "/admin/pdv/caixa" },
        ],
      },
    ],
  },
  {
    label: "MINHA LOJA",
    items: [
      { k: "lojavirtual", label: "Aparência", icon: PaletteIcon, href: "/admin/aparencia" },
      { k: "pagamentos", label: "Pagamentos", icon: CreditCardIcon, href: "/admin/pagamento" },
      {
        k: "config",
        label: "Configurações",
        icon: TagIcon,
        subs: [
          { label: "Geral", href: "/admin/configuracoes" },
          { label: "Horários", href: "/admin/configuracoes#horarios" },
        ],
      },
    ],
  },
] as const;

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
