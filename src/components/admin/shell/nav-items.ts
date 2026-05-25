// Estrutura de navegação do admin — Início + 4 grupos colapsáveis (accordion).
// soon:true → renderizado como disabled com badge "em breve" pelo sidebar-content.
import {
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
    // "Venda balcão" (PDV full-page) removida em 2026-05-21 — consolidada
    // em "Vendas". Nova venda agora abre como modal a partir do listing
    // (/admin/pedidos). Rota /admin/pdv segue viva como fallback de URL
    // direta. Ver `new-sale-modal.tsx`.
    k: "operacao",
    label: "Operação",
    icon: ZapIcon,
    items: [
      { k: "vendas",   label: "Vendas",                  icon: ReceiptIcon,        href: "/admin/pedidos"               },
      { k: "caixa",    label: "Caixa do dia",            icon: WalletIcon,         href: "/admin/pdv/caixa"             },
      // Onda 1.4 (2026-05-24) — label simplificado de "Movimentação de
      // estoque" pra "Estoque" só. Lojista procura "estoque", não
      // "movimentação". A tela /admin/estoque agora tem 2 views (saldo +
      // histórico de movimentações) então o label antigo não cabe.
      { k: "estoque",  label: "Estoque",                 icon: ArrowLeftRightIcon, href: "/admin/estoque",   exact: true },
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
      // "Estoque baixo" removido do menu em 2026-05-24 — duplicava /admin/estoque.
      // Acesso à lista de "para repor" segue por: (a) card do dashboard, (b) chip
      // "Para repor" dentro de /admin/estoque. Consolidação completa em 4 abas
      // (Saldo / Movimentações / Alertas / Relatório) entra na Onda 1.4.
      // { k: "estoque-baixo", label: "Estoque baixo",  icon: AlertTriangleIcon, href: "/admin/estoque/relatorio" },
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
      // "Filtros da loja" escondido do menu em 2026-05-24 — feature GHOST:
      // CRUD de atributo funciona no admin mas o produto NÃO tem campo
      // `attributes` no schema (comentário em tab-loja-online.tsx:6-8 confirma
      // "trabalho futuro") + storefront não tem join product↔attribute. Lojista
      // cria filtro que nunca aparece na loja online → quebra "funciona-ou-esconde".
      // Rota /admin/atributos segue viva por URL. Volta ao menu quando o
      // schema do produto + integração storefront estiverem prontos (Onda 2.3+).
      // { k: "filtros",    label: "Filtros da loja",     icon: ListFilterIcon,    href: "/admin/atributos"        },
      { k: "cupons",     label: "Códigos de desconto", icon: TicketPercentIcon, href: "/admin/promocoes/cupons" },
      { k: "pagamento",  label: "Formas de pagamento", icon: CreditCardIcon,    href: "/admin/pagamento"        },
      // "Equipe" escondida do menu em 2026-05-24 (Onda 1.2 do plano 4 ondas).
      // Motivo: storeMembership existe no schema mas getCurrentStore filtra
      // ownerId=userId em store-context.ts:26 — membros não-owner não entram
      // no admin. Feature visível na UI tem que entregar ponta-a-ponta no
      // fluxo comum (régua "funciona-ou-esconde"). Rota /admin/equipe segue
      // viva por URL direto (owner consegue acessar pra futuro CRUD), mas
      // não promete na navegação. Volta ao menu na Onda 5+ quando RBAC real.
      // { k: "equipe",     label: "Equipe",              icon: UserCogIcon,       href: "/admin/equipe"           },
      { k: "dados-loja", label: "Dados da loja",       icon: Building2Icon,     href: "/admin/configuracoes"    },
      // "Plano e assinatura" escondido do menu em 2026-05-24 — Fase 3 ainda
      // não chegou (Stripe não integrado). UI atual mostra 3 cards de plano
      // com CTA disabled → lojista clica e nada acontece → "funciona-ou-esconde".
      // Rota /admin/assinatura segue viva por URL. Volta quando Stripe + planos
      // pagos forem ligados (Fase 3 — Monetização).
      // { k: "assinatura", label: "Plano e assinatura",  icon: ReceiptTextIcon,   href: "/admin/assinatura"       },
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
