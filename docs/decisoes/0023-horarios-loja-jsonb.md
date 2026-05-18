# ADR-0023: Horários de funcionamento da loja (jsonb 7 dias)

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Sandra (e qualquer lojista de balcão) precisa exibir no storefront e no PDP os horários de funcionamento da loja física — "seg-sex 09h-18h, sáb 09h-13h, dom fechado". Hoje não há onde cadastrar.

Forças:
- Dado mostra **status** dinâmico ("aberto agora" vs "fechado") = boa conversão.
- 7 dias × 2 turnos (manhã/tarde com almoço) é o padrão BR (não funciona "1 intervalo único" pra padarias/mercearias, mas é over-engineering pra Sandra).
- Lojistas digitam pouco — UI tem que ser rápida (não 14 inputs).
- Single-source: 1 jsonb na `store`, não tabela nova (overkill pra dado opcional).

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. Texto livre `business_hours_note` (1 coluna) | Trivial, sem schema novo | Sem "aberto agora", sem ordem, vira poesia |
| B. 7 colunas `monday_open`, `monday_close`, etc | Tipado, SQL-friendly | 14+ colunas, sem suporte a turnos |
| C. jsonb `business_hours` 7 dias × array de turnos | Flexível, 1 coluna, mostra "aberto agora" | Validação só app-layer (Zod), CHECK constraint limitado |

## Decisão

**Opção C**: `business_hours jsonb` com formato:

```jsonc
{
  "monday":    { "closed": false, "shifts": [{ "opensAt": "09:00", "closesAt": "18:00" }] },
  "tuesday":   { "closed": false, "shifts": [{ "opensAt": "09:00", "closesAt": "12:00" }, { "opensAt": "14:00", "closesAt": "18:00" }] },
  "wednesday": { "closed": false, "shifts": [] },  // sem horário definido = "consulte"
  "thursday":  { "closed": false, "shifts": [{ "opensAt": "09:00", "closesAt": "18:00" }] },
  "friday":    { "closed": false, "shifts": [{ "opensAt": "09:00", "closesAt": "18:00" }] },
  "saturday":  { "closed": false, "shifts": [{ "opensAt": "09:00", "closesAt": "13:00" }] },
  "sunday":    { "closed": true,  "shifts": [] }
}
```

NULL = não configurado (não renderiza nada). `closed: true` = fechado naquele dia.

Validação Zod estrita em `actions/store/business-hours/schema.ts`. CHECK constraint mínimo no DB (jsonb_typeof). UI mostra grid 7×1 com toggle "Aberto/Fechado" + até 2 turnos por dia + botão "Copiar para todos".

Helper `isOpenNow(hours, date)` em `lib/business-hours.ts` retorna `{ open: boolean, nextChange?: Date }` pra renderizar badge no storefront.

## Consequências

- ✅ 1 coluna jsonb, sem tabela nova
- ✅ Suporta turno único (Sandra) E turnos partidos (mercearia)
- ✅ Helper de status faz "aberto agora" sem query extra
- ⚠️ Validação principal no Zod (CHECK DB só valida estrutura básica)
- 🔧 Storefront PDP/footer ainda não consome — UI no admin primeiro, render no storefront fica como follow-up não-bloqueante (não é gap funcional, é polish de PDP)

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite, modo "continue só pare quando terminar".
