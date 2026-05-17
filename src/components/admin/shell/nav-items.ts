// Estrutura de navegação do admin — Port Dublin v3 (ADR-0019 reabertura, Onda A.3).
//
// Replica fielmente o handoff `PIXEL PERFECT/admin/v3/bagy-admin.jsx`:
// 3 seções nomeadas (CONTROLE INTERNO / MINHA LOJA / CONTA) com items que
// podem ter sub-items recolhíveis.
//
// Items marcados `soon: true` apontam pra módulos AINDA não implementados
// (Atributos, Grupos de clientes, Promoções, Marketing, Relatórios, Equipe,
// Assinatura, etc). Eles são renderizados visualmente como cinza-claro
// não-clicáveis com badge "em breve" — quando ADR-0020/21/22/23 fecharem,
// basta tirar a flag e o item passa a navegar.
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
  StarIcon,
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
          { label: "Atributos", href: "/admin/produtos/atributos", soon: true },
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
          { label: "Grupos de clientes", href: "/admin/clientes/grupos", soon: true },
          { label: "Contatos", href: "/admin/clientes/contatos", soon: true },
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
          { label: "Cupons", href: "/admin/promocoes/cupons", soon: true },
          { label: "Ofertas", href: "/admin/promocoes/ofertas", soon: true },
        ],
      },
      { k: "marketing", label: "Marketing", icon: StarIcon, href: "/admin/marketing", soon: true },
      { k: "relatorios", label: "Relatórios", icon: ArchiveIcon, href: "/admin/relatorios", soon: true },
    ],
  },
  {
    label: "MINHA LOJA",
    items: [
      {
        k: "lojavirtual",
        label: "Loja virtual",
        icon: PaletteIcon,
        subs: [
          { label: "Aparência", href: "/admin/aparencia" },
          { label: "Produtos da loja", href: "/admin/loja/produtos", soon: true },
          { label: "Categorias da loja", href: "/admin/loja/categorias", soon: true },
          { label: "Banners", href: "/admin/loja/banners", soon: true },
        ],
      },
      { k: "pagamentos", label: "Pagamentos", icon: CreditCardIcon, href: "/admin/pagamento" },
      {
        k: "config",
        label: "Configurações",
        icon: TagIcon,
        subs: [
          { label: "Identidade", href: "/admin/configuracoes/identidade", soon: true },
          { label: "WhatsApp", href: "/admin/configuracoes/whatsapp", soon: true },
          { label: "Horários", href: "/admin/configuracoes/horarios", soon: true },
          { label: "Equipe", href: "/admin/configuracoes/equipe", soon: true },
          { label: "Geral", href: "/admin/configuracoes" },
        ],
      },
    ],
  },
  {
    label: "CONTA",
    items: [
      { k: "assinatura", label: "Assinatura", icon: SparklesIcon, href: "/admin/assinatura", soon: true },
      { k: "suporte", label: "Suporte", icon: InfoIcon, href: "mailto:contato@vitre.site" },
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
