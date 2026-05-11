# Limpeza pré-deploy — 2026-05-11

> Registro da poda executada antes do deploy Vercel. Mantido como histórico
> pra explicar o que sumiu da árvore e por quê. Pode ser deletado depois do
> Lote 5 canvas se ficar redundante com ADRs.

## Por que esta limpeza

Auditoria sênior em 2026-05-11 identificou ~6.5MB de arquivos mortos
acumulados durante o redesign canvas-v1 e a auditoria pré-deploy
2026-05-10. Tudo já cumpriu seu propósito e estava criando ruído na
árvore de arquivos do editor, na busca textual e no entendimento de
"o que esse projeto realmente é".

Critério de remoção: arquivo só sai se cumpre **todas** estas:

- Não é referenciado por nenhum import TypeScript/JSX.
- Não é referenciado por nenhum comando de `package.json`.
- Já cumpriu seu propósito documentado (redesign aplicado, seed rodado, etc).
- Tem substituto vivo se ainda for útil futuramente.

## O que saiu

### Bundle Figma do redesign canvas-v1 (~6 MB)

- `canvas-referencia.html` (1.5 MB) — HTML exportado do Figma Make,
  contendo manifest de 17 entries em base64+gzip. Já foi extraído,
  consumido (Lotes 1–4), e o resultado virou os componentes em
  `src/components/storefront/`. Referência morta.
- `canvas-extracted-tmp/` (4.7 MB, 27 arquivos) — saída da extração:
  `_vitre-storefront.jsx`, `_vitre-admin.jsx`, `_vitre-onboarding.jsx`,
  `_vitre-shared.jsx`, `RELATORIO.md`, JSON do manifest, e `unnamed-*`
  binários intermediários. Diretório de trabalho temporário, já
  consumido. Estava no `.gitignore` desde sempre — só limpa do disco.
- `scripts/extract-canvas-tmp.cjs` — script CommonJS que extraía o
  bundle. Sem `canvas-referencia.html` não tem o que extrair. Estava
  no `.gitignore` — só limpa do disco.

### Documento que era na verdade HTML (120 KB)

- `docs/painel-admin.md` — 3468 linhas. Apesar do nome `.md`, era um
  dump HTML do dashboard do Fly.io salvo como markdown, provavelmente
  pra servir de inspiração de design ("estilo Fly.io" mencionado em
  `CLAUDE.md`). Inspiração já foi internalizada nos tokens em
  `src/app/globals.css` (paleta `navy-*`, surfaces translúcidas,
  sombras tintadas) e nos componentes admin reais. O HTML original
  não acrescenta nada hoje.

### Backups one-shot (~4 KB)

- `scripts/migrations-backup-2026-05-10T14-57-41-674Z.json` — backup
  pontual gerado por `db-cleanup.mjs` durante a auditoria. Estado já
  estabilizado. Estava no `.gitignore`.
- `scripts/seed-sandra-banner.cjs` — **manter por enquanto**. Se Sandra
  já está cadastrada de verdade em prod e o banner real está no banco,
  podar. Caso contrário, é o seed inicial do cliente piloto.

### Cache TypeScript

- `tsconfig.tsbuildinfo` (612 KB) — cache incremental do `tsc`. Já
  estava no `.gitignore` via `*.tsbuildinfo`. Limpa do disco para
  evitar confusão quando alguém abrir o explorador de arquivos.

## O que NÃO saiu (e por quê)

- `src/lib/auth.ts`, `auth-server.ts`, `auth-client.ts` — pareciam
  duplicação. Não são. Cada um tem propósito distinto: config do Better
  Auth (server, instancia única), helpers de Server Component (cache),
  e hooks do client (signIn/signUp/useSession). Separação correta.

- `drizzle/` (9 migrations) e `supabase/sql/` (14 scripts) — sistema
  paralelo proposital. Drizzle não captura RLS policies, índices
  parciais, GIN trigram, triggers, roles. Manter os dois, mas adicionar
  tracking formal do `supabase/sql/` foi registrado como débito pra
  pós-deploy. Ver "Próximos passos" abaixo.

- `docs/sessoes/2026-05-10-auditoria-completa/` (152 KB) — logs e
  relatórios da auditoria de 7 ondas. Histórico precioso pra entender
  decisões. Manter.

## Inconsistência conhecida — tracking de SQL custom

`drizzle/` é trackado pelo Drizzle via tabela `__drizzle_migrations`.
`supabase/sql/` **não tem tracking**. Pra descobrir o que está aplicado,
roda:

```bash
node scripts/check-sql-applied.mjs
```

Script funciona, mas é audit *post-hoc*, não controle. Próximo ADR
(0011 proposto) vai criar tabela `_vitre_custom_sql_applied` e fazer
`scripts/apply-sql.ts` registrar cada apply. A partir daí o check
vira opcional.

## Próximos passos sugeridos

Não-bloqueantes pra deploy, mas catalogados pra não esquecer:

1. **CategoryDialog + CategoryEditDialog → componente único** com prop
   `mode`. ~200 linhas economizadas, drift futuro eliminado.

2. **`product-form.tsx` (735 linhas) → 6 sub-componentes**: identidade,
   preço, estoque, mídia, variantes, meta. Mantém orquestrador em ~150
   linhas. Variant editor (316 linhas) já é precedente bom.

3. **Página `/admin/produtos` precisa ler `?erro=` da URL** e renderizar
   banner/toast. Atualmente engole erros do `createDraftProduct` em
   silêncio — UX confuso ("não consigo criar produtos").

4. **ADR-0011 — tracking formal de SQL custom** (ver inconsistência
   acima).

5. **Rotação automática de segredos** pós primeiro vazamento — `.env.local`
   foi compartilhado em auditoria externa, todos os segredos foram
   regenerados. Documentar processo em `docs/runbooks/`.

---

Mantenedor: Anderson Felipe  
Auditoria: 2026-05-11  
Decisão fechada por: founder + assistente sênior
