# ADR-0029: Equipe multi-user com 3 roles (owner/staff/viewer)

- **Data**: 2026-05-18
- **Status**: aceito (schema + UI placeholder); integração Better Auth pendente

## Contexto

Hoje 1 loja = 1 user (Better Auth user.ownerId). Memory team
`pivot-vitre-gestao-roadmap-fases-2-6-2026-05-15` marca a invariante
"Better Auth somente lojista". Mas conforme cliente cresce, precisa
de funcionários: caixa registra venda, vendedor consulta estoque, gerente
fecha caixa. Hoje compartilhar credencial vira risco.

3 roles minimum-viable:
- **owner**: tudo, incluindo deletar loja, gestão de equipe, mexer em pagamento/aparência
- **staff**: PDV, pedidos, estoque, clientes, leads, atributos, cupons. Não mexe em config/pagamento/equipe/excluir loja.
- **viewer**: leitura apenas (relatórios, listings). Não cria, não edita, não deleta.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. Continuar 1-store-1-user, compartilhar credencial | Zero código | Risco de segurança, sem auditoria por usuário |
| B. Membership table + RBAC middleware | Padrão da indústria, audit-ready | Mexe em Better Auth, refactor de getCurrentStore |
| C. Sub-accounts no Better Auth (organizations plugin) | Plugin oficial | Curva, e ainda precisa do RBAC custom |

## Decisão

**Opção B**, em 2 fases:

### Fase 1 (esta ADR — schema + UI placeholder)
- Tabela `store_membership` (store_id, user_id, role, invitedBy, status, createdAt, updatedAt)
- `store.owner_id` permanece source-of-truth do dono (compatível com tudo que já existe)
- Page `/admin/equipe` lista owner atual + membros + status. Convite via email = placeholder "em breve".
- `getCurrentStore` continua resolvendo store via owner_id pra preservar comportamento existente.

### Fase 2 (follow-up — não nesta ADR)
- Integrar Better Auth signup link com `store_membership` (Resend email com token).
- Refactor `getCurrentStore(userId)` → resolver loja via:
  1. owner_id direto, OU
  2. store_membership.user_id (status='active')
- Middleware RBAC em actions críticas (delete, payment, equipe) — bloqueia staff/viewer.
- UI bloqueia botões CTA conforme role.

## Consequências

- ✅ Schema pronto pra escalar
- ✅ Owner-only mantém invariante de hoje (sem regressão)
- ⚠️ UI já mostra `/admin/equipe` mas convite real é Fase 2 (button disabled)
- 🔧 RBAC enforcement vive na Fase 2 — staff/viewer ainda não restritos por código

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
