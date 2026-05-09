# ADR-0011: Cor da loja restrita ao bottom-nav e badge da sacola

- **Data**: 2026-05-09
- **Status**: aceito

## Contexto

Até esta decisão, o `StoreShell` injetava `store.primaryColor` no token shadcn `--primary` (e em `--ring`), o que fazia QUALQUER elemento do storefront com utilities `bg-primary` / `text-primary` / `border-primary` / `ring-primary` / `text-primary-foreground` herdar a cor escolhida pela lojista — cerca de 25 pontos de consumo: badges de promoção, CTAs, focus rings, skip link, links "Ver todos", thumbnail ativa, dot do banner, número da seção do checkout, etc.

Isso é anti-padrão de SaaS profissional. Marketplaces e lojas brancas (Mercado Livre, Shopee, Magalu) usam a cor da marca como **acento de pertencimento** — quase sempre só na navegação ativa e indicadores de estado da própria conta — e mantêm cores funcionais (CTA, promo, success) em paletas semânticas estáveis. Com a cor da loja vazando para CTAs e estados, a hierarquia visual quebra (CTA "comprar" e badge "-40%" ficam da mesma cor de "Ver todos"), e qualquer elemento novo adicionado com `bg-primary` herda a cor sem que o autor perceba.

Forças em jogo:

- A cor da loja **deve** existir no storefront — é parte da identidade que a lojista escolheu na onboarding.
- Mas **não pode** vazar para CTAs/promo/focus, sob pena de virar ruído visual.
- Uma vez que o token é o `--primary` shadcn, é trivialmente fácil pra qualquer commit futuro reintroduzir o problema sem perceber.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Continuar sobrescrevendo `--primary`** (status quo) | Zero código a mover | Hierarquia visual frágil, regressão a cada novo `bg-primary` adicionado, brand color compete com elementos funcionais |
| **B. Trocar `bg-primary` → cor neutra/Vitrê em ~25 lugares e manter `--primary` injetado** | Mantém token único | Frágil — qualquer elemento novo com `bg-primary` reintroduz o bug; carga cognitiva alta |
| **C. Token isolado `--brand-store` com fallback `var(--primary)`** | Acentos da loja explícitos no código (`bg-brand-store`); resto volta a Vitrê fixo automaticamente; impossível regredir por acidente | Token novo no design system; um conceito a mais pra entender |

## Decisão

**Opção C.** Criar token isolado `--brand-store` (fallback `var(--primary)`) injetado pelo `StoreShell` no escopo da loja. A cor da lojista afeta APENAS:

- **Bottom-nav** (4 itens fixos: Home / Categorias / Buscar / Sacola): pill ativa, ícone ativo, label ativa, badge contador.
- **Badge contador da sacola** no `StoreHeader`.

Tudo o mais (CTAs, promo, focus rings, skip link, links, thumbs, banner dots, números de seção) volta a usar `--primary` Vitrê fixo. Promo passa a usar `rose-600` (convenção universal de e-commerce) e success da `OrderLottie` passa a usar o token `--success` que já existia em `globals.css`.

## Consequências

- ✅ Hierarquia visual estável: CTA "comprar agora" sempre Vitrê azul, badge "-40%" sempre rose-600, success sempre verde. Cor da loja vira sinalização de "você está na navegação dessa loja".
- ✅ Código novo é seguro por default: `bg-primary` adicionado em qualquer canto do storefront herda Vitrê (não a cor da loja). Pra usar a cor da loja, autor precisa ESCREVER `bg-brand-store` explicitamente — opt-in, não opt-out.
- ✅ Storefront fica coerente entre lojas com cores muito diferentes (verde, laranja, rosa) — o esqueleto visual não se desfaz.
- ⚠️ Lojista que esperava "minha cor por toda parte" terá menos da cor escolhida na superfície. Aceito porque o ganho de profissionalismo > volume de cor.
- ⚠️ Página `/p/[token]` segue injetando `--brand-store` (consistência) embora hoje não consuma nada do token — escolha preventiva caso futuro reuse algum componente do storefront.
- 🔧 Se 5+ lojistas pedirem após MVP no ar pra "ter mais cor própria", reabrir com novo ADR — possíveis pontos de extensão são botões secundários do header e divisores de seção, não CTAs.

## Quem decidiu

Anderson Felipe (founder), tomada após auditoria visual sênior no chat 2 (pós-hardening P0).
