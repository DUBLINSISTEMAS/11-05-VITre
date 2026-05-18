// Estrutura de navegação do admin — Port Dublin v3 (ADR-0019 reabertura, Onda A.3).
//
// Replica fielmente o handoff `PIXEL PERFECT/admin/v3/bagy-admin.jsx`:
// 3 seções nomeadas (CONTROLE INTERNO / MINHA LOJA / CONTA) com items que
// podem ter sub-items recolhíveis.
//
// Items marcados `soon: true` apontam pra módulos AINDA não implementados.
// Eles são renderizados visualmente como cinza-claro não-clicáveis com badge
// "em breve" — quando o ADR correspondente fechar, basta tirar a flag e o item
// passa a navegar. Roadmap pós-Onda A.17 (2026-05-18):
//   B2.4 Horários       → /admin/configuracoes/horarios
//   B3.1 Atributos      → /admin/atributos (ADR-0024)
//   B3.2 Grupos clientes→ /admin/clientes/grupos
//   B3.3 Cupons         → /admin/promocoes/cupons
//   B3.4 Contatos       → /admin/clientes/contatos  (inbox WhatsApp)
//   B4.1 Relatórios     → /admin/relatorios
//   B4.2 Equipe         → /admin/configuracoes/equipe
//   B.5  Assinatura     → /admin/assinatura  (founder implementa)
import {
  ArchiveIcon,
  BoxesIcon,
  CreditCardIcon,
  HomeIcon,
  InfoIcon,
  type LucideIcon,
  PackageIcon,
  PaletteIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";

export interface AdminNavSubItem {
  label: string;
  href: string;
  /** Módulo ainda não implementado — renderiza disabled com badge "em breve". */
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
  /** Bolinha indicadora ("tem novidade"). */
  dot?: boolean;
  /** Módulo ainda não implementado. */
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
          { label: "Atributos", href: "/admin/atributos" },
          { label: "Banners", href: "/admin/banners" },
        ],
      },
      { k: "estoque", label: "Estoque", icon: BoxesIcon, href: "/admin/estoque" },
      {
        k: "clientes",
        label: "Clientes",
        icon: UsersIcon,
        subs: [
          { label: "Meus clientes", href: "/admin/clientes" },
          { label: "Grupos de clientes", href: "/admin/clientes/grupos" },
          { label: "Contatos", href: "/admin/contatos" },
        ],
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
      {
        k: "promocoes",
        label: "Promoções",
        icon: SparklesIcon,
        dot: true,
        subs: [
          { label: "Cupons", href: "/admin/promocoes/cupons" },
        ],
      },
      { k: "relatorios", label: "Relatórios", icon: ArchiveIcon, href: "/admin/relatorios" },
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
          { label: "Horários", href: "/admin/configuracoes/horarios", soon: true },
          { label: "Equipe", href: "/admin/equipe" },
        ],
      },
    ],
  },
  {
    label: "CONTA",
    items: [
      { k: "assinatura", label: "Assinatura", icon: SparklesIcon, href: "/admin/assinatura" },
      { k: "suporte", label: "Suporte", icon: InfoIcon, href: "/admin/suporte" },
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
    return item.subs.some((s) => !s.soon && isSubItemActive(s, pathname));
  }
  return false;
}
