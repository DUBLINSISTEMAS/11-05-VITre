# Glossário

Termos do projeto. Use estes nomes consistentemente em código, UI, documentação.

| Termo | Significado |
|---|---|
| **Tenant** | Cada loja na Vitrê. Identificado por `store.id` (uuid) ou `store.slug` (string). |
| **Lojista** | Dono de uma loja. Usuário com role `store_owner` no Better Auth. |
| **Cliente final** | Pessoa que compra na loja da lojista. **NÃO** tem conta no Vitrê. |
| **Catálogo público** | `vitre.com.br/[storeSlug]` — sem login, ISR. |
| **Painel admin** | `vitre.com.br/admin` — exige login do lojista. |
| **Pedido** (`order`) | Registro server-side de uma intenção de compra. Estados: `awaiting_whatsapp` → `confirmed` → `fulfilled` ou `canceled`. |
| **Código curto** (`shortCode`) | 4 chars alfanuméricos para correlacionar pedido com mensagem WhatsApp. Ex: `A7K2`. |
| **RLS** | Row-Level Security do Postgres. Garante isolamento entre tenants. |
| **Variante** | Versão específica de um produto (cor, tamanho, banho). Tem preço/estoque próprio. |
| **Banner** | Imagem promocional na home da loja. Tem ordem, link opcional, ativo/inativo. |
| **Storefront** | Sinônimo de "catálogo público da loja" (uso interno em código). |
