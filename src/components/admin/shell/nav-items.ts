import {
  HomeIcon,
  ImageIcon,
  type LucideIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  /** Label curto para bottom nav mobile (cabe em ~60px). */
  shortLabel?: string;
  icon: LucideIcon;
  /** True para match exato (rota raiz). */
  exact?: boolean;
  /** Desktop-only — sidebar mostra; bottom nav mobile fica em 4 itens fixos. */
  desktopOnly?: boolean;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    href: "/admin",
    label: "Início",
    icon: HomeIcon,
    exact: true,
  },
  {
    href: "/admin/produtos",
    label: "Produtos",
    icon: PackageIcon,
  },
  {
    href: "/admin/categorias",
    label: "Categorias",
    icon: TagIcon,
    desktopOnly: true,
  },
  {
    href: "/admin/banners",
    label: "Banners",
    icon: ImageIcon,
    desktopOnly: true,
  },
  {
    href: "/admin/pedidos",
    label: "Pedidos",
    icon: ReceiptIcon,
  },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    shortLabel: "Ajustes",
    icon: SettingsIcon,
  },
] as const;
