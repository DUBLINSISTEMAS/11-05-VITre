# ADR-0007: Identidade visual e design system do Vitrê

- **Data**: 2026-05-07
- **Status**: aceito

## Contexto

Vitrê tem logo definida (sacola estilizada formando um sorriso interno, fundo azul royal vibrante). Anderson pediu pegada minimalista no painel admin. Cliente final (storefront) deve permitir personalização por loja.

## Decisão

### Cores do Vitrê (admin, marketing, emails)

Cor primária extraída da logo:

```css
--vitre-primary-50:  #EEF2FE;
--vitre-primary-100: #DCE5FD;
--vitre-primary-200: #B9CBFB;
--vitre-primary-300: #8FAAF8;
--vitre-primary-400: #5B7DF1;
--vitre-primary-500: #1E3FE6;  /* ← cor da logo */
--vitre-primary-600: #1832C2;
--vitre-primary-700: #14279E;
--vitre-primary-800: #112180;
--vitre-primary-900: #0C1862;
--vitre-primary-950: #070D3D;
```

Neutros (shadcn/ui neutral):
- background: `#FFFFFF` (light) / `#0A0A0A` (dark — futuro)
- foreground: `#0A0A0A` (light) / `#FAFAFA` (dark)
- muted: `#F5F5F5`
- border: `#E5E5E5`

Estados:
- success: `#16A34A`
- warning: `#EAB308`
- destructive: `#DC2626`

### Tipografia

- **Sans**: Geist (já no repo, via `next/font/google`).
- **Mono**: Geist Mono (códigos curtos `#A7K2`, números de pedido).
- **Tamanhos**: escala Tailwind padrão (text-sm 14px, text-base 16px, text-lg 18px, text-xl 20px, text-2xl 24px). Mobile-first.

### Pegada visual

- **Minimalista**: espaçamento generoso (`space-y-6`, `gap-4`), bordas sutis (`border-neutral-200`), sombras leves (`shadow-sm`).
- **Cards** com `rounded-2xl` em vez de `rounded-md` — toque mais amigável e moderno.
- **Botões primários**: bg azul Vitrê, texto branco, `rounded-xl`, `font-medium`.
- **Botões secundários**: outline neutral, hover com bg neutral-100.
- **Inputs**: `border-neutral-200`, focus ring azul Vitrê (`ring-2 ring-vitre-primary-500/20`).
- **Sem decorações desnecessárias**: sem gradientes excessivos, sem ilustrações que poluem, sem ícones genéricos. Lucide-react para ícones.

### Storefront (catálogo público da loja)

- Cor primária = `store.primaryColor` (configurável pelo lojista no onboarding).
- Default = azul Vitrê.
- Anderson pode oferecer paleta sugerida com 6-8 cores curadas no onboarding (não color picker livre — lojista escolheria roxo neon).

```ts
const SUGGESTED_PRIMARY_COLORS = [
  { name: "Azul Vitrê", value: "#1E3FE6" },
  { name: "Preto", value: "#0A0A0A" },
  { name: "Rosa Brand", value: "#E91E63" },
  { name: "Verde Esmeralda", value: "#10B981" },
  { name: "Vinho", value: "#9F1239" },
  { name: "Areia", value: "#A38468" },
  { name: "Roxo", value: "#7C3AED" },
  { name: "Laranja", value: "#EA580C" },
];
```

Custom hex permitido em "Outra cor" → input com validação `/^#[0-9A-F]{6}$/i`.

### Tokens em CSS (`src/app/globals.css`)

```css
@theme {
  --color-vitre-50: #EEF2FE;
  /* ... */
  --color-vitre-500: #1E3FE6;
  /* ... */
  --color-vitre-950: #070D3D;
}
```

### Logo no app

- `/public/brand/logo-principal.webp` — versão azul completa (icone branco sobre fundo azul). Usar em telas de login, marketing, emails.
- `/public/brand/icone-branco.webp` — só o ícone branco (sacola). Usar em headers e favicons.
- `/public/brand/com-nome.webp` — logo com nome "Vitrê". Usar em rodapés, "Powered by".

## Consequências

- ✅ Identidade consistente desde a Fase 0.
- ✅ Lojista pode personalizar storefront sem violar o design system.
- ✅ Painel admin com cor única evita "cada lojista vê uma cor diferente" (confunde branding do Vitrê).
- ⚠️ Paleta sugerida no storefront é opinada. Lojista que queira cor específica fora da lista usa "Outra cor" — mas não pode controlar tons (apenas primary). Aceitável no MVP.
- 🔧 Dívida: dark mode no admin (Fase 2+).

## Quem decidiu

Anderson Felipe (founder) — direção visual minimalista + azul da logo. Conselho-5-agentes converteu em tokens.
