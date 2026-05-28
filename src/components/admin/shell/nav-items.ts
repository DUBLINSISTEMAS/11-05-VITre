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
  FileTextIcon,
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
      { k: "vendas",     label: "Vendas",                icon: ReceiptIcon,        href: "/admin/pedidos"               },
      // Semana 5 da ressignificação (2026-05-28) — orçamento ganha rota
      // dedicada (era misturado em /admin/pedidos com filtro). Joalheiro
      // recebe pedido de orçamento o dia inteiro; merece atalho próprio.
      { k: "orcamentos", label: "Orçamentos",            icon: FileTextIcon,       href: "/admin/orcamentos"            },
      { k: "caixa",      label: "Caixa do dia",          icon: WalletIcon,         href: "/admin/pdv/caixa"             },
      // Onda 1.4 (2026-05-24) — label simplificado de "Movimentação de
      // estoque" pra "Estoque" só. Lojista procura "estoque", não
      // "movimentação". A tela /admin/estoque agora tem 2 views (saldo +
      // histórico de movimentações) então o label antigo não cabe.
      { k: "estoque",  label: "Estoque",                 icon: ArrowLeftRightIcon, href: "/admin/estoque",   exact: true },
      { k: "receber",  label: "A receber",               icon: ClockIcon,          href: "/admin/financeiro/receber"    },
      // S2.2 (2026-05-26) — Contas a pagar destrava DRE honesto.
      { k: "pagar",    label: "A pagar",                 icon: ClockIcon,          href: "/admin/financeiro/pagar"      },
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
      // Bloco E da ressignificação (2026-05-27): topo do grupo Gestão.
      // Responde a pergunta-mãe "Quanto sobrou?" — primeiro item porque
      // é o que o lojista mais procura e merece atalho direto.
      { k: "resultado",    label: "Resultado",      icon: TrendingUpIcon,    href: "/admin/relatorios/resultado" },
      { k: "relatorios",    label: "Relatórios",     icon: BarChart2Icon,     href: "/admin/relatorios"        },
      // S3.6 (2026-05-26) — capital empatado em produto que nao vende ha 60d+.
      { k: "estoque-parado", label: "Estoque parado", icon: AlertTriangleIcon, href: "/admin/estoque/parado"   },
      // S3.4 (2026-05-26) — lotes vencendo (perfumaria/cosmetico).
      { k: "estoque-vencendo", label: "Estoque vencendo", icon: ClockIcon, href: "/admin/estoque/vencendo" },
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
      // "Filtros da loja" (/admin/atributos) removido em 2026-05-27 (Bloco A
      // da ressignificação). CRUD funcionava mas integração storefront tava
      // quebrada há 2 sprints (junction product_attribute_value sem UI de
      // vinculação produto↔valor + sem filtros dinâmicos no /categoria).
      // Régua "funciona ou esconde" reativada com força total. Schema
      // (attribute, attribute_value, product_attribute_value) preservado pra
      // reativar quando integração storefront landar (sprint dedicada).
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
