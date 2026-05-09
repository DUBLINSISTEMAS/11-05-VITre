# ADR-0009: Design system com tokens navy + sistema dual brand/primary

- **Data**: 2026-05-07
- **Status**: aceito
- **Substitui parcialmente**: [ADR-0007](./0007-identidade-visual-vitre.md) (mantém paleta `vitre-*` como legado, troca neutros)

## Contexto

ADR-0007 fixou identidade do Vitrê (azul `#1E3FE6` + Geist + neutros shadcn). No início do Bloco C da Fase 1.3, o founder pediu pegada visual mais profissional inspirada no painel do Fly.io (HTML salvo em `docs/painel-admin.md`, 3468 linhas), mantendo cor da marca e personalização por loja no storefront.

O Fly usa três decisões estruturais que o shadcn neutral não atende:

1. **Neutros frios (`navy-*`)** em vez de cinza puro — superfícies têm um leve viés azul que harmoniza com o accent vibrante.
2. **Sombras tintadas** com a cor primária — `shadow-violet-700/10` em vez de cinza neutro.
3. **Surfaces translúcidas** com `backdrop-blur` para hierarquia de elevação.

Adicionalmente, o Vitrê precisa que o token "primary" seja **fixo no admin** (azul Vitrê) e **configurável no storefront** (cor da loja) sem fork de design system.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A — Manter neutros shadcn (cinza), só trocar `--primary` | Zero custo de migração | Perde a coesão "frio + accent" do Fly; sombras cinza não combinam com primary vibrante |
| B — Substituir `--primary` shadcn por var configurável + paleta navy custom | Mantém shadcn semantics; lojas configuram primary; admin permanece coeso | Exige mapear todos os tokens shadcn; sobrescrever `--primary` quebra distinção shadcn entre `primary` e `accent` |
| C — Renomear shadcn `--primary` → `--brand` e criar novo `--accent` configurável | Semanticamente mais claro | Quebra todos os componentes shadcn já gerados; alto custo |

## Decisão

**Opção B com refinamento**: introduzir token de marca fixa (`--brand`) **separado** do token shadcn (`--primary`). O `--primary` lê de `--brand` por padrão, mas pode ser sobrescrito por contexto (storefront via `BrandProvider`). O `--accent` shadcn permanece como hover sutil (navy-100). Paleta `navy-*` substitui o role de neutros nas superfícies, enquanto `vitre-*` (ADR-0007) é mantido como utility legado.

### Tokens de marca (fixos)

```css
--brand: #1E3FE6;                /* azul Vitrê — institucional */
--brand-foreground: #FAFAFA;     /* branco quase puro */
```

Use `bg-brand`/`text-brand` quando precisar da cor Vitrê **independente** do contexto (logo no admin, badge "Powered by", emails).

### Paleta navy (neutros frios)

Substituem `gray-*` / `slate-*` em superfícies e texto secundário:

```
navy-50  navy-100 navy-200 navy-300 navy-400
navy-500 navy-600 navy-700 navy-800 navy-900 navy-950
```

Validação WCAG AA:
- `text-navy-900` sobre `bg-navy-50` → 18:1 ✅
- `text-navy-600` sobre `bg-white` → 7.7:1 ✅ (= `--muted-foreground`)
- `text-navy-400` sobre `bg-white` → 3.7:1 ⚠️ apenas para ícones e elementos não-textuais
- `text-white` sobre `bg-brand` → 6.8:1 ✅

### Token configurável

```css
--primary: var(--brand);   /* default = brand */
```

No admin: usa o default. No storefront: `BrandProvider` (`src/components/common/brand-provider.tsx`) sobrescreve via inline style com `store.primaryColor`. Componentes shadcn (`Button`, `Input` etc.) leem de `bg-primary`/`text-primary-foreground` e funcionam em ambos contextos sem alteração.

### Mapeamento shadcn

| Token shadcn | Resolve para |
|--------------|--------------|
| `--background` | `--navy-50` |
| `--foreground` | `--navy-900` |
| `--card`, `--popover` | branco puro (sólido) |
| `--card-foreground`, `--popover-foreground` | `--navy-900` |
| `--primary` | `var(--brand)` (default) |
| `--secondary` | `--navy-100` |
| `--muted` | `--navy-100` |
| `--muted-foreground` | `--navy-600` |
| `--accent` | `--navy-100` (hover sutil — semantics shadcn original) |
| `--border` | `color-mix(navy-200 70%, transparent)` |
| `--input` | `--navy-200` |
| `--ring` | `var(--primary)` |

### Sombras brand-aware

Utilities customizadas (`@utility shadow-brand-{sm,md,lg}`) projetam a `--primary` corrente com baixa opacidade (12–16%). Equivalente ao `shadow-violet-700/10` do Fly. Sombras base (`shadow-sm/md/lg`) usam tint de `navy-900` em vez de preto neutro.

### Surfaces translúcidas

Utilities `surface-base` (92% branco), `surface-elevated` (85% + blur 12px), `surface-dark` (95% navy-950 + blur). Opacidade definida acima de 80% para garantir contraste WCAG AA sobre qualquer fundo decorativo. Use em headers sticky, popovers, bottom nav (mobile).

### Padrão `hocus:`

`@custom-variant hocus (&:where(:hover, :focus-visible))` — convergência de estados hover (mouse) e focus (teclado), padrão Fly. Reduz boilerplate e garante consistência entre os dois.

## Consequências

- ✅ Identidade Vitrê preservada (cor `#1E3FE6` segue como brand fixa).
- ✅ Lojista configura cor do storefront sem fork — provider injeta um `--primary`.
- ✅ Componentes shadcn já gerados (`Button`, `Card`, `Dialog`…) herdam tokens automaticamente — zero refactor.
- ✅ Componentes do Bloco B (`price-input`, `image-uploader` etc.) absorvem o novo visual sem mudança de código.
- ✅ Acessibilidade: contraste WCAG AA validado nos pares texto/superfície principais.
- ⚠️ A cor primária da loja pode ter contraste ruim com `--primary-foreground` fixo em branco quando lojista escolhe tom claro (ex.: areia `#A38468` ainda passa, mas amarelos não passariam). Mitigação: paleta sugerida em `lib/brand.ts` é curada, e `--primary-foreground` aceita override no `BrandProvider`.
- ⚠️ `text-navy-400` não passa AA para texto pequeno — regra: usar só para ícones e decorativos. Documentado.
- ⚠️ Paleta `vitre-*` permanece exposta como utility legado. Próximos componentes devem preferir `bg-brand` sobre `bg-vitre-500`. Migração não-bloqueante.
- 🔧 Dívida: dark mode (Fase 2+) exigirá overrides de cada token via `@custom-variant dark`. Estrutura preparada — bastará adicionar `:root.dark { ... }`.
- 🔧 Dívida: validação automática de contraste primary/foreground no onboarding quando lojista digita hex custom (hoje só valida formato).

## Quem decidiu

Anderson Felipe (founder) + Conselho-5-agentes (sessão 2026-05-07). Veredicto: GO COM RESSALVAS — adotar tokens agora (Fase 1.3 Bloco C), deferir assets pesados (background shapes, Cmd+K palette, fontes pagas) para Bloco B' / pós-MVP. Esta ADR registra a primeira camada (tokens). Camada visual (shell + páginas) vem em ADR seguinte.
