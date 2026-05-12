import {
  HomeIcon,
  ImageIcon,
  type LucideIcon,
  PackageIcon,
  PaletteIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TagIcon,
} from "lucide-react";

/**
 * Item de nav simples (link direto pra rota).
 */
export interface AdminNavLink {
  kind: "link";
  href: string;
  label: string;
  icon: LucideIcon;
  /** True para match exato (rota raiz). */
  exact?: boolean;
}

/**
 * Grupo de nav com sub-items recolhíveis. Clica no header pra expandir,
 * clica num child pra navegar. O grupo é considerado "ativo" se a rota
 * atual bate com algum child (header em estado open por default nesse caso).
 */
export interface AdminNavGroup {
  kind: "group";
  label: string;
  icon: LucideIcon;
  children: AdminNavLink[];
}

export type AdminNavEntry = AdminNavLink | AdminNavGroup;

export const ADMIN_NAV_ITEMS: readonly AdminNavEntry[] = [
  {
    kind: "link",
    href: "/admin",
    label: "Painel",
    icon: HomeIcon,
    exact: true,
  },
  {
    kind: "group",
    label: "Sua Loja",
    icon: StoreIcon,
    children: [
      {
        kind: "link",
        href: "/admin/produtos",
        label: "Produtos",
        icon: PackageIcon,
      },
      {
        kind: "link",
        href: "/admin/categorias",
        label: "Categorias",
        icon: TagIcon,
      },
      {
        kind: "link",
        href: "/admin/banners",
        label: "Banners",
        icon: ImageIcon,
      },
      {
        kind: "link",
        href: "/admin/pedidos",
        label: "Pedidos",
        icon: ReceiptIcon,
      },
    ],
  },
  {
    kind: "link",
    href: "/admin/aparencia",
    label: "Aparência",
    icon: PaletteIcon,
  },
  {
    kind: "link",
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: SettingsIcon,
  },
] as const;

/** Acha se um link está ativo dado o pathname atual. */
export function isLinkActive(link: AdminNavLink, pathname: string): boolean {
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

/** Acha se algum child do grupo está ativo. */
export function isGroupActive(group: AdminNavGroup, pathname: string): boolean {
  return group.children.some((c) => isLinkActive(c, pathname));
}
