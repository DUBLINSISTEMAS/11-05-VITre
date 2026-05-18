# ADR-0024: Atributos universais (catálogo de cores/tamanhos/material)

- **Data**: 2026-05-18
- **Status**: aceito

## Contexto

Variantes hoje (`product_variant.attributes jsonb`) guardam pares ad-hoc como `{ tamanho: "P", cor: "preto" }`. Funciona, mas:

1. Lojista digita "Cor: Preto", "Cor: preto", "Cor: PRETO" em produtos diferentes → impossível filtrar storefront por "Cor=Preto" sem heurística.
2. Não há catálogo central de cores/tamanhos pra reuso entre produtos.
3. Quando Sandra quer "vermelho cereja" pintado num swatch, hoje precisa entrar em cada variante e copiar o `colorHex`. Sem central.

Solução: catálogo de **atributos** (tipo "Cor", "Tamanho", "Material") + **valores** (cada cor com seu hex, cada tamanho com sua label) que viram fonte canônica.

Restrições:
- NÃO refatorar `product_variant.attributes` agora — preserva dados existentes; refatoração fica como Fase 2 do próprio módulo.
- Vínculo product↔attribute_value vai existir como **junction** (`product_attribute_value`) pra filtros do storefront mesmo sem refatorar variantes.

## Opções consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| A. Manter só jsonb em variant, não criar tabela | Zero schema novo | Sem filtro storefront, sem reuso de cor hex |
| B. Tabela `attribute` + `attribute_value` + refatorar variant pra FK array | Modelo limpo | Migra dados (variant.attributes → FK), risco de regressão grande |
| C. Tabela `attribute` + `attribute_value` + junction `product_attribute_value` (sem mexer em variant) | Catálogo central + filtro storefront + zero risco | Vínculo variant↔attribute_value ainda jsonb (refatoração Fase 2) |

## Decisão

**Opção C**. Esquema:

```
attribute:
  id, store_id, name "Cor", type "color|size|text", position, isActive

attribute_value:
  id, store_id, attribute_id FK, label "Vermelho", colorHex "#C71F1F"?, position

product_attribute_value (junction):
  product_id FK, attribute_value_id FK, PK composto
  ON DELETE CASCADE em ambos lados
```

`type=color` permite `colorHex` (pinta swatch); `type=size` é texto simples; `type=text` é catch-all (material, gênero, faixa etária).

UI:
- `/admin/atributos` lista + CRUD inline (modal pra criar/editar atributo + add value)
- Em `/admin/produtos/[id]`: card "Atributos" abaixo de variantes mostra checklist de valores aplicáveis (selo aparece com cor se `type=color`)
- Storefront: PDP renderiza chips de atributos vinculados; filtros de categoria/listagem filtram via junction (Fase 2 — não nesta ADR).

## Consequências

- ✅ Catálogo central, sem digitar a mesma cor 50× com hex diferente
- ✅ Junction pré-popula filtro storefront futuro
- ✅ ZERO risco em dados de variantes existentes (`product_variant.attributes jsonb` intacto)
- ⚠️ Variant ainda guarda `{ cor: "preto" }` desconectado do attribute_value canônico — duplicação aceita
- 🔧 Fase 2: refatorar `product_variant.attributes` pra `attribute_value_ids: uuid[]` quando dor real surgir (storefront filter por variante)

## Quem decidiu

Anderson Felipe (founder) — execução autônoma 2026-05-18 noite.
