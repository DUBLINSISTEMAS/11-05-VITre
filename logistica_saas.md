\# Mandato Master — Vitrê de MVP para SaaS Shopify-like



Auditoria sênior + pesquisa de referência (Shopify, Nuvemshop, Shein, 

Shopee, Mercado Livre) consolidada. Sistema atual está em 8.2/10 

(segurança e arquitetura sólidas). Este mandato leva para 9.0/10 

(SaaS vendável a nível profissional).



ESTADO INICIAL CONFIRMADO (NÃO REFAZER):

\- env.ts preprocess: FEITO

\- /sucesso usa publicToken: FEITO

\- createStore atômico: FEITO

\- Sandra → "lojista" em comentários: FEITO

\- Bottom-nav com 5 abas (favoritos): FEITO

\- Hero card refatorado: FEITO

\- CSP libera Sentry: FEITO

\- JSON-LD InStock por estoque: FEITO

\- SQL 15 revoke grants: CRIADO mas NÃO APLICADO (Anderson aplica)

\- Categorias opt-in (includeNicheCategories): FEITO



NÃO REFAÇA NADA ACIMA. Pule se topar.



\## Como você vai trabalhar



Modo trator. Aprovação única, autônomo até relatório final. Commit 

por mudança lógica. Build verde + testes verdes entre ondas. 

Se algo travar, pula, marca no relatório, NÃO PARA.



Anderson aprovou TUDO neste mandato. Não pergunte "posso?" entre 

ondas. Execute, commita, segue.



NÃO crie ADRs. NÃO escreva docs novos. NÃO refatore product-form 

em sub-componentes (fase pós-Stripe). NÃO toque em feature flags, 

analytics, tracking SQL custom.



Estimativa total: 35-50h. Distribuído em 2-3 sessões dele.



\## ANTES de qualquer código



Lê em paralelo (15 min):

\- CLAUDE.md

\- src/db/schema/catalog.ts (vai mexer em product\_variant)

\- src/components/admin/product-form.tsx (só ler, não refatorar)

\- src/components/admin/variant-editor.tsx

\- src/components/storefront/bottom-nav.tsx

\- src/components/storefront/store-header.tsx

\- src/components/storefront/store-shell.tsx

\- src/components/storefront/product-purchase-panel.tsx

\- src/components/storefront/product-gallery.tsx

\- src/app/(storefront)/\[storeSlug]/page.tsx

\- src/app/(storefront)/\[storeSlug]/produto/\[productSlug]/page.tsx

\- src/components/admin/shell/admin-sidebar.tsx

\- src/components/admin/store-config-form.tsx

\- next.config.ts

\- src/lib/image.ts e src/lib/image-client.ts



\---



\## ONDA 1 — Upload e compressão de imagem (3-4h)



Hoje: limite 8MB rejeita foto de iPhone. Lojista frustra.



Referência pesquisada: Nuvemshop recomenda 1024x1024 até 10MB. 

Shopify default é 20MB. Pra Vitrê com Vercel limite de Server Action 

\~10MB, vamos com 25MB original + compressão client agressiva.



1.1. `next.config.ts`: 

\- `experimental.serverActions.bodySizeLimit = '4mb'` (server recebe 

&#x20; comprimido)



1.2. `src/lib/image-client.ts` (browser-image-compression):

\- Aceita arquivo original ATÉ 25MB (verifica file.size antes)

\- Se > 25MB: rejeita com mensagem "Imagem muito grande (máximo 25 MB). 

&#x20; Tente uma foto menor ou comprima antes de enviar."

\- Configuração: `maxSizeMB: 2, maxWidthOrHeight: 2400, useWebWorker: 

&#x20; true, fileType: 'image/webp'`

\- Banner: `maxSizeMB: 1` (já que é display, não detalhe)



1.3. `src/lib/image.ts`: `MAX\_UPLOAD\_BYTES = 4 \* 1024 \* 1024`. 

Comentário: "client comprime antes (browser-image-compression), 

server recebe sempre ≤4MB. Alinhamento com next.config bodySizeLimit."



1.4. Em TODOS os uploaders (`image-uploader.tsx`, 

`store-image-uploader.tsx`, `category-image-uploader.tsx`, banner 

uploader), adiciona estado intermediário:

\- `"Preparando imagem..."` durante compressão client

\- Loading spinner visível

\- Se compressão falha (raro): mostra "Não conseguimos preparar essa 

&#x20; imagem. Tente uma foto diferente." + botão "Tentar outra"



1.5. Mensagens de erro lojista-friendly em todos os pontos:

\- Imagem > 25MB: "Imagem muito grande (máximo 25 MB)."

\- Formato errado: "Formato não suportado. Use JPG, PNG ou WebP."

\- Erro de rede: "Erro ao enviar. Verifique sua conexão."

\- Erro genérico server: "Não foi possível enviar. Tente de novo em 

&#x20; alguns segundos."



Commits:

\- `feat(upload): aceita 25MB com compressão automática client`

\- `feat(upload): mensagens de erro lojista-friendly`



\---



\## ONDA 2 — Logo no sidebar admin + Configurações organizadas (3-4h)



\### 2A — Logo no sidebar



Hoje `admin-sidebar.tsx` tem 16 linhas — não renderiza logo. AdminShell 

já passa `storeName`, `storeSlug`, `primaryColor` mas NÃO `logoUrl`.



2A.1. `src/components/admin/shell/admin-shell.tsx`: passar `logoUrl` 

(de `store.logoUrl`) como prop pro sidebar.



2A.2. `admin-sidebar.tsx`: renderiza `<Image>` no topo se `logoUrl` 

existir. Fallback: ícone genérico (Store da lucide-react) + nome da 

loja em texto. Tamanho: 40x40 quadrado com `object-fit: contain`.



2A.3. Mesma coisa no `header.tsx` mobile do admin se aplicável.



\### 2B — Configurações organizadas em seções



`store-config-form.tsx` (447 linhas) tem tudo numa lista vertical 

gigante. Cor primária ocupa metade da tela.



2B.1. Refatora em 4 cards/seções (não accordion — cards visíveis 

sempre, scroll natural):



\*\*Seção 1: Identidade\*\*

\- Nome da loja

\- Descrição curta

\- Slug (URL) — com helper text "Como sua loja aparece no link"



\*\*Seção 2: Visual\*\*

\- Logo (com helper text — ver 2B.3)

\- Ícone (com helper text — ver 2B.3)

\- Cor primária — REDESENHO:

&#x20; - Grid 6x2 de swatches pré-definidos (cores comuns: navy, vermelho, 

&#x20;   rosa, verde, dourado, preto, branco, roxo, laranja, turquesa, 

&#x20;   bege, marrom)

&#x20; - Botão "Mais opções" abre color picker custom abaixo

&#x20; - Atualmente provavelmente é input type="color" gigante — substitui

&#x20; - Cada swatch: 32x32, border-radius-md, hover scale leve, ring quando 

&#x20;   selecionado



\*\*Seção 3: Contato\*\*

\- WhatsApp (E.164 + display)

\- Email opcional



\*\*Seção 4: Localização\*\*

\- Cidade

\- Estado (select UF)

\- Checkbox "Exibir cidade na loja"



2B.2. Cada seção tem header pequeno (font-medium 14px) + descrição 

em 12px muted. Padding interno consistente. Borda separadora entre 

seções.



2B.3. \*\*Helper text logo vs ícone\*\* (resolve a dúvida do Anderson):



Abaixo do campo Logo:

> "Aparece no topo da sua loja e no painel admin. Use a versão completa 

> do seu logo (com nome). Recomendado: 400x200 px, fundo transparente, 

> PNG ou WebP."



Abaixo do campo Ícone:

> "Aparece na aba do navegador (favicon) e quando alguém compartilha 

> sua loja em redes sociais. Use a versão compacta (só símbolo, sem 

> texto). Recomendado: 512x512 px quadrado, PNG ou WebP."



Commits:

\- `feat(admin): logo da loja aparece no sidebar e header admin`

\- `refactor(admin): configurações em 4 seções organizadas`

\- `feat(admin): cor primária via swatches + custom picker`

\- `docs(admin): helper text explica diferença logo vs ícone`



\---



\## ONDA 3 — UX de compra fluida (5-6h)



Hoje: cliente adiciona produto, fica preso no PDP, tem que voltar 

manualmente. Padrão Shopify/Nuvemshop é minicart drawer + you-may-like.



\### 3A — Minicart drawer abre automático ao adicionar



3A.1. Olha implementação atual de `sacola-drawer.tsx`. Provavelmente 

já existe drawer que abre via state. Adapta pra abrir ao chamar 

`addItem` do cart store.



3A.2. Quando `addItem` é chamado:

\- Drawer abre pela direita

\- Item recém-adicionado tem destaque visual ("Adicionado!" + 

&#x20; highlight \~1s)

\- Mostra subtotal e total da sacola

\- 2 botões: "Continuar comprando" (fecha drawer) e "Finalizar pedido" 

&#x20; (vai pra /sacola)



3A.3. Animação suave (CSS transition translate-x, 200ms). Sem 

framer-motion.



\### 3B — Ícone de sacola no header storefront



Hoje só tem no bottom-nav (mobile). Falta no header.



3B.1. `src/components/storefront/store-header.tsx`: adiciona ícone 

de sacola à direita com badge de quantidade (count do cart store). 

Click abre o sacola-drawer.



3B.2. Aparece em desktop E mobile (no mobile sobreposto ao bottom-nav, 

mas serve como atalho rápido sem precisar rolar até embaixo).



\### 3C — "Você pode gostar também" no PDP



3C.1. Cria `src/lib/storefront/related-products-loader.ts`:



```typescript

import { and, eq, ne, sql } from "drizzle-orm";

import { unstable\_cache } from "next/cache";

import { cache } from "react";



import { productTable } from "@/db/schema";

import { STORE\_CACHE\_TAG } from "@/lib/storefront/store-loader";

import { withTenant } from "@/lib/tenant";

// + tipos compartilhados



export const getRelatedProducts = cache(async (

&#x20; storeId: string,

&#x20; storeSlug: string,

&#x20; excludeProductId: string,

&#x20; categoryId: string | null,

&#x20; limit = 6,

) => {

&#x20; const cached = unstable\_cache(

&#x20;   async () => {

&#x20;     return withTenant(storeId, null, async (tx) => {

&#x20;       // 1. Mesma categoria primeiro

&#x20;       let related = \[];

&#x20;       if (categoryId) {

&#x20;         related = await tx.select()

&#x20;           .from(productTable)

&#x20;           .where(and(

&#x20;             eq(productTable.storeId, storeId),

&#x20;             eq(productTable.categoryId, categoryId),

&#x20;             eq(productTable.isActive, true),

&#x20;             ne(productTable.id, excludeProductId),

&#x20;           ))

&#x20;           .orderBy(sql`RANDOM()`)

&#x20;           .limit(limit);

&#x20;       }

&#x20;       // 2. Fallback: mais recentes da loja

&#x20;       if (related.length < limit) {

&#x20;         const fallback = await tx.select()...; 

&#x20;         related = \[...related, ...fallback].slice(0, limit);

&#x20;       }

&#x20;       // 3. Anexa primeira imagem de cada (usa \_shared.ts attachPrimaryImage)

&#x20;       return attachPrimaryImage(tx, related);

&#x20;     });

&#x20;   },

&#x20;   \["related-products", storeId, excludeProductId, categoryId ?? "none"],

&#x20;   { tags: \[STORE\_CACHE\_TAG(storeSlug)], revalidate: 600 },

&#x20; );

&#x20; return cached();

});

```



3C.2. No PDP, abaixo da seção de produto e antes do footer, adiciona:



```tsx

const related = await getRelatedProducts(

&#x20; store.id, 

&#x20; store.slug, 

&#x20; product.id, 

&#x20; product.categoryId, 

&#x20; 6

);



{related.length > 0 \&\& (

&#x20; <section className="mt-12">

&#x20;   <h2 className="text-lg font-semibold mb-4">Você pode gostar também</h2>

&#x20;   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

&#x20;     {related.map(p => (

&#x20;       <ProductCard key={p.id} product={p} storeSlug={store.slug} variant="overlay" />

&#x20;     ))}

&#x20;   </div>

&#x20; </section>

)}

```



3C.3. Em mobile, vira scroll horizontal (`overflow-x-auto flex gap-3` 

em vez de grid).



\### 3D — Botão "Adicionar e continuar"



Hoje PDP tem só "Adicionar à sacola". Adiciona segundo botão 

secundário menor abaixo: "Adicionar e voltar pra loja". 

`router.push(${baseHref})` depois de adicionar.



Commits:

\- `feat(storefront): minicart drawer abre automático ao adicionar`

\- `feat(storefront): ícone sacola sticky no header com badge`

\- `feat(storefront): related products no PDP`

\- `feat(storefront): botão adicionar-e-continuar no PDP`



\---



\## ONDA 4 — Variantes com foto destacada (Modelo Shopify) (6-8h)



CONTEXTO PESQUISADO: Shopify e Nuvemshop usam "featured image por 

variant". Galeria do produto é compartilhada, mas cada variant aponta 

pra UMA das fotos como destaque. Cliente clica em cor → foto principal 

do PDP troca pra essa.



\### 4A — Schema



4A.1. Drizzle migration nova: `featured\_image\_id uuid references 

product\_image(id) on delete set null` na tabela `product\_variant`.



```sql

ALTER TABLE product\_variant 

&#x20; ADD COLUMN featured\_image\_id uuid REFERENCES product\_image(id) ON DELETE SET NULL;

CREATE INDEX product\_variant\_featured\_image\_idx ON product\_variant(featured\_image\_id);

```



4A.2. Atualiza `src/db/schema/catalog.ts` `productVariantTable` com o 

campo novo.



4A.3. Roda `pnpm drizzle-kit generate` pra gerar o arquivo de 

migration. NÃO aplica em prod (Anderson aplica manualmente via 

`pnpm db:push` ou Supabase Dashboard).



\### 4B — Admin: selector de foto destacada



4B.1. `variant-editor.tsx`: para cada variante na lista, abaixo dos 

campos atuais (nome, SKU, preço, estoque), adiciona:



```tsx

<div>

&#x20; <label className="text-sm font-medium">Foto destacada (opcional)</label>

&#x20; <p className="text-xs text-muted-foreground mb-2">

&#x20;   Quando o cliente selecionar essa variação, essa foto vai aparecer 

&#x20;   em destaque.

&#x20; </p>

&#x20; <div className="grid grid-cols-6 gap-2">

&#x20;   <button 

&#x20;     type="button"

&#x20;     onClick={() => onSetFeatured(variantIndex, null)}

&#x20;     className={cn("aspect-square rounded border-2", 

&#x20;       variant.featuredImageId === null ? "border-primary" : "border-transparent")}

&#x20;   >

&#x20;     <span className="text-xs">Padrão</span>

&#x20;   </button>

&#x20;   {productImages.map(img => (

&#x20;     <button 

&#x20;       key={img.id}

&#x20;       type="button"

&#x20;       onClick={() => onSetFeatured(variantIndex, img.id)}

&#x20;       className={cn("aspect-square rounded border-2 overflow-hidden",

&#x20;         variant.featuredImageId === img.id ? "border-primary" : "border-transparent")}

&#x20;     >

&#x20;       <Image src={img.url} width={64} height={64} alt="" />

&#x20;     </button>

&#x20;   ))}

&#x20; </div>

</div>

```



4B.2. `update-product.ts` action: persiste `featuredImageId` por 

variante quando salva.



\### 4C — Storefront: troca foto ao selecionar variante



4C.1. `product-purchase-panel.tsx`: quando cliente seleciona variante 

via swatch ou select, busca o `featuredImageId` da variante 

selecionada.



4C.2. `product-gallery.tsx`: aceita prop `activeFeaturedImageId`. 

Quando muda, faz scroll/troca pra essa foto na galeria principal.



4C.3. Comunicação entre componentes: usa context ou prop drilling. 

Provavelmente já tem state lifted pra variante no PDP — adapta.



4C.4. Animação CSS fade entre fotos (transition opacity 200ms). Sem 

framer-motion.



\### 4D — Swatches no card de produto na listagem



Quando produto tem variantes de cor, mostra até 5 swatches embaixo 

do card. Padrão Nuvemshop.



4D.1. `product-card.tsx`: aceita prop opcional `variantSwatches`. Se 

o produto tem variantes que são CORES (detecta por nome da opção: 

"cor", "color", "cores"), pega até 5 e renderiza pequenos círculos 

coloridos abaixo do preço.



4D.2. Hover/touch no swatch troca temporariamente a foto do card pra 

foto da variante (se houver featured\_image\_id setado). Sem isso, só 

visual.



4D.3. Se tiver mais de 5 cores, mostra "+N" como 6º círculo.



Commits:

\- `feat(db): adiciona featured\_image\_id em product\_variant`

\- `feat(admin): selector de foto destacada por variante`

\- `feat(storefront): troca foto principal ao selecionar variante`

\- `feat(storefront): swatches de cor no card de produto`



\---



\## ONDA 5 — Editor de imagem inline (6-8h)



Lib: `react-easy-crop` (\~30KB, sem deps pesadas).



5.1. `pnpm add react-easy-crop`



5.2. Cria `src/components/shared/image-editor-dialog.tsx`:



```tsx

"use client";



import Cropper from "react-easy-crop";

import { useState } from "react";

// + imports UI



interface ImageEditorDialogProps {

&#x20; open: boolean;

&#x20; imageFile: File | null;

&#x20; aspectRatio: number;  // 16/9, 1, 4/3

&#x20; onConfirm: (croppedBlob: Blob) => void;

&#x20; onCancel: () => void;

}



export function ImageEditorDialog({ 

&#x20; open, imageFile, aspectRatio, onConfirm, onCancel 

}: ImageEditorDialogProps) {

&#x20; const \[crop, setCrop] = useState({ x: 0, y: 0 });

&#x20; const \[zoom, setZoom] = useState(1);

&#x20; const \[rotation, setRotation] = useState(0);

&#x20; const \[croppedAreaPixels, setCroppedAreaPixels] = useState(null);

&#x20; 

&#x20; const imageUrl = imageFile ? URL.createObjectURL(imageFile) : null;

&#x20; 

&#x20; return (

&#x20;   <Dialog open={open} onOpenChange={onCancel}>

&#x20;     <DialogContent>

&#x20;       <DialogTitle>Ajustar imagem</DialogTitle>

&#x20;       

&#x20;       <div className="relative h-\[400px] bg-black/5">

&#x20;         {imageUrl \&\& (

&#x20;           <Cropper

&#x20;             image={imageUrl}

&#x20;             crop={crop}

&#x20;             zoom={zoom}

&#x20;             rotation={rotation}

&#x20;             aspect={aspectRatio}

&#x20;             onCropChange={setCrop}

&#x20;             onZoomChange={setZoom}

&#x20;             onRotationChange={setRotation}

&#x20;             onCropComplete={(\_, areaPixels) => setCroppedAreaPixels(areaPixels)}

&#x20;           />

&#x20;         )}

&#x20;       </div>

&#x20;       

&#x20;       <div className="flex gap-4 items-center">

&#x20;         <label className="text-sm">Zoom</label>

&#x20;         <Slider value={\[zoom]} min={1} max={3} step={0.1} 

&#x20;                 onValueChange={(\[v]) => setZoom(v)} />

&#x20;       </div>

&#x20;       

&#x20;       <Button variant="ghost" 

&#x20;               onClick={() => setRotation((r) => (r + 90) % 360)}>

&#x20;         <RotateCw /> Girar 90°

&#x20;       </Button>

&#x20;       

&#x20;       <div className="flex justify-end gap-2">

&#x20;         <Button variant="ghost" onClick={onCancel}>Cancelar</Button>

&#x20;         <Button onClick={handleConfirm}>Confirmar</Button>

&#x20;       </div>

&#x20;     </DialogContent>

&#x20;   </Dialog>

&#x20; );

&#x20; 

&#x20; async function handleConfirm() {

&#x20;   const blob = await cropAndRotateImage(

&#x20;     imageFile, croppedAreaPixels, rotation

&#x20;   );

&#x20;   onConfirm(blob);

&#x20; }

}

```



5.3. Função auxiliar `cropAndRotateImage` (canvas-based crop + rotate, 

output WebP 90%). Cria em mesmo arquivo ou util separado.



5.4. \*\*Aspect ratios por contexto:\*\*

\- Banner: 16/9

\- Logo: 1 (quadrado) — quando lojista escolhe usar editor

\- Ícone: 1 (quadrado)

\- Categoria: 4/3

\- Produto: 1 (quadrado)



5.5. \*\*Modo OBRIGATÓRIO\*\* em:

\- `banner-edit-dialog.tsx`: após selecionar arquivo, abre editor com 

&#x20; aspect 16/9. Lojista confirma → blob vai pro upload.

\- `store-image-uploader.tsx` (logo + ícone): após selecionar, editor 

&#x20; com aspect adequado.



5.6. \*\*Modo OPCIONAL\*\* em:

\- `image-uploader.tsx` (produto): upload vai direto. Depois do upload, 

&#x20; mostra thumbnail com botão "Ajustar imagem" embaixo. Click abre 

&#x20; editor com aspect 1:1. Confirma → re-upload (substitui).

\- `category-image-uploader.tsx`: idem, aspect 4:3.



5.7. Pipeline: blob retornado pelo editor passa pelo 

`browser-image-compression` (compressão final pra WebP) antes do upload.



Commits:

\- `chore(deps): adiciona react-easy-crop`

\- `feat(shared): ImageEditorDialog com recorte + reposicionar + rotação`

\- `feat(admin): editor obrigatório em banner e logo/ícone`

\- `feat(admin): editor opcional em produto e categoria`



\---



\## ONDA 6 — Desktop responsivo profissional (8-10h)



CONTEXTO PESQUISADO: padrão Shopify Dawn, Nuvemshop layouts (Atlántico, 

Bahia), Shein. Niche stores usam horizontal menu com 5-7 categorias 

top + ícones de utilidade à direita.



\### 6A — Componente DesktopHeader



6A.1. Cria `src/components/storefront/desktop-header.tsx`:



```tsx

"use client";



interface DesktopHeaderProps {

&#x20; store: Store;

&#x20; categories: CategoryTree\[];

}



export function DesktopHeader({ store, categories }: DesktopHeaderProps) {

&#x20; const { count: cartCount } = useCart();

&#x20; 

&#x20; return (

&#x20;   <header className="sticky top-0 z-30 bg-background border-b border-border 

&#x20;                      transition-all">

&#x20;     <div className="max-w-7xl mx-auto px-8 h-20 flex items-center gap-8">

&#x20;       

&#x20;       {/\* Logo + nome (esquerda) \*/}

&#x20;       <Link href={`/${store.slug}`} className="flex items-center gap-3">

&#x20;         {store.logoUrl ? (

&#x20;           <Image src={store.logoUrl} width={40} height={40} alt={store.name} />

&#x20;         ) : (

&#x20;           <Store className="w-10 h-10 text-foreground" />

&#x20;         )}

&#x20;         <span className="font-semibold text-lg">{store.name}</span>

&#x20;       </Link>

&#x20;       

&#x20;       {/\* Categorias inline (centro) \*/}

&#x20;       <nav className="flex items-center gap-6 flex-1">

&#x20;         <Link href={`/${store.slug}`} className="text-sm font-medium hover:text-primary">

&#x20;           Início

&#x20;         </Link>

&#x20;         {categories.length <= 4 ? (

&#x20;           // Inline simples

&#x20;           categories.map(cat => (

&#x20;             <Link key={cat.id} href={`/${store.slug}/categoria/${cat.slug}`}

&#x20;                   className="text-sm font-medium hover:text-primary">

&#x20;               {cat.name}

&#x20;             </Link>

&#x20;           ))

&#x20;         ) : (

&#x20;           // Dropdown "Categorias"

&#x20;           <CategoriesDropdown categories={categories} storeSlug={store.slug} />

&#x20;         )}

&#x20;         <Link href={`/${store.slug}/sobre`} className="text-sm font-medium hover:text-primary">

&#x20;           Sobre

&#x20;         </Link>

&#x20;       </nav>

&#x20;       

&#x20;       {/\* Ícones de utilidade (direita) \*/}

&#x20;       <div className="flex items-center gap-2">

&#x20;         <button aria-label="Buscar" onClick={openSearch}>

&#x20;           <Search className="w-5 h-5" />

&#x20;         </button>

&#x20;         <Link href={`/${store.slug}/favoritos`} aria-label="Favoritos">

&#x20;           <Heart className="w-5 h-5" />

&#x20;         </Link>

&#x20;         <button aria-label="Sacola" onClick={openSacolaDrawer} 

&#x20;                 className="relative">

&#x20;           <ShoppingBag className="w-5 h-5" />

&#x20;           {cartCount > 0 \&\& (

&#x20;             <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground 

&#x20;                            text-xs rounded-full w-5 h-5 flex items-center justify-center">

&#x20;               {cartCount}

&#x20;             </span>

&#x20;           )}

&#x20;         </button>

&#x20;       </div>

&#x20;       

&#x20;     </div>

&#x20;   </header>

&#x20; );

}

```



6A.2. CategoriesDropdown: hover/click abre painel dropdown com lista 

de categorias e subcategorias (se houver). Mantém aberto enquanto 

mouse sobre, fecha quando sai.



\### 6B — Integração com store-shell



6B.1. `store-shell.tsx`: 

\- `<DesktopHeader>` em `hidden lg:block`

\- `<StoreHeader>` (mobile atual) em `block lg:hidden`

\- Bottom-nav: adiciona `lg:hidden` no container do nav



6B.2. Container max-width: 

\- Páginas storefront com `max-w-7xl mx-auto` no desktop

\- Mobile mantém full-width



\### 6C — PDP em 2 colunas no desktop



`produto/\[productSlug]/page.tsx`:



6C.1. Estrutura:



```tsx

<div className="lg:grid lg:grid-cols-\[1fr,420px] lg:gap-12">

&#x20; 

&#x20; {/\* Coluna esquerda: galeria (sticky em desktop) \*/}

&#x20; <div className="lg:sticky lg:top-24 lg:self-start">

&#x20;   <ProductGallery images={product.images} />

&#x20; </div>

&#x20; 

&#x20; {/\* Coluna direita: painel de compra \*/}

&#x20; <div>

&#x20;   <ProductPurchasePanel product={product} variants={variants} />

&#x20; </div>

&#x20; 

</div>



{/\* Related products full-width abaixo \*/}

<RelatedProducts ... />

```



6C.2. Mobile mantém empilhado (sem o grid). Tailwind responsive 

classes handle.



\### 6D — Grid de produtos responsivo



6D.1. `product-grid.tsx`: 

`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4`



6D.2. Em `product-grid` variant "overlay", aumenta breakpoints pra 

aproveitar tela.



\### 6E — Sticky header com colapso



6E.1. Em DesktopHeader: usa scroll listener (ou IntersectionObserver) 

pra detectar scroll > 100px. Quando scrollado, header altura colapsa 

de h-20 → h-14 com transition.



```tsx

const \[scrolled, setScrolled] = useState(false);



useEffect(() => {

&#x20; const handler = () => setScrolled(window.scrollY > 100);

&#x20; window.addEventListener("scroll", handler, { passive: true });

&#x20; return () => window.removeEventListener("scroll", handler);

}, \[]);



<header className={cn(

&#x20; "sticky top-0 z-30 bg-background border-b transition-all",

&#x20; scrolled ? "h-14" : "h-20"

)}>

```



Commits:

\- `feat(storefront): DesktopHeader com logo + categorias + ícones`

\- `feat(storefront): esconde bottom-nav no desktop`

\- `feat(storefront): PDP em 2 colunas no desktop`

\- `feat(storefront): grid produtos responsivo até 5 colunas`

\- `feat(storefront): header sticky com colapso ao scrollar`



\---



\## ONDA 7 — Tradução PT-BR remanescente + polish (2-3h)



7.1. \*\*"All Products" → "Todos os produtos"\*\* em 

`src/components/storefront/categories-sidebar.tsx:175`.



7.2. Grep global por strings em inglês remanescentes no storefront:

```bash

grep -rn -E "All Products|All Categories|View All|See All|Out of stock|In stock|Add to cart|Search results|No results" src/components/storefront/

```



Substituir cada uma:

\- "All Products" / "All Categories" → "Todos os produtos" / "Todas as categorias"

\- "View All" / "See All" / "View more" → "Ver todos" / "Ver mais"

\- "Out of stock" → "Esgotado"

\- "In stock" → "Em estoque"

\- "Add to cart" → "Adicionar à sacola"

\- "Search results" → "Resultados da busca"

\- "No results" / "No products found" → "Nada encontrado"



7.3. NÃO mexer em strings de admin que sejam logs internos, dev tools, 

ou contexto técnico.



7.4. \*\*Polish visual final:\*\*

\- Confere que comentários internos do código (// xyz) que falavam em 

&#x20; inglês contextual continuam OK

\- Confere que aria-labels do storefront são em PT-BR



Commits:

\- `i18n(storefront): traduz strings remanescentes pra PT-BR`



\---



\## ONDA 8 — Validação final (30 min)



8.1. `pnpm test` — 77/77 esperado (ou mais se você adicionou testes 

de variant-featured-image)

8.2. `pnpm run lint` — 0 errors

8.3. `pnpm exec tsc --noEmit` — clean

8.4. `pnpm run build` — 35+ rotas, build verde, ≤300KB First Load JS

8.5. \*\*Smoke visual local\*\* com `pnpm dev`:

\- Desktop (1440px): DesktopHeader aparece, bottom-nav some, PDP em 2 

&#x20; colunas, grid 4-5 colunas

\- Mobile (375px DevTools): StoreHeader simples, bottom-nav com 5 abas, 

&#x20; PDP empilhado

\- Adicionar produto no PDP: drawer abre automático

\- Selecionar variante com featured\_image: foto principal troca

\- Upload de imagem no admin: editor abre (banner/logo) ou botão 

&#x20; "ajustar" aparece (produto/categoria)



Se algum item falhar: investigar e corrigir NA PRÓPRIA ONDA relacionada, 

não criar fix mascarando regressão.



\---



\## ONDA 9 — Relatório final



Formato exato:



```

═══════════════════════════════════════════════════════════

MANDATO MASTER — Vitrê 8.2 → 9.0

═══════════════════════════════════════════════════════════



ONDA 1 — Upload e compressão (Xh)

✅ 1.1-1.5: <N commits>

&#x20;  Compressão 25MB original → 2MB WebP



ONDA 2 — Logo sidebar + Configurações (Xh)

✅ 2A: Logo no sidebar admin

✅ 2B: Configurações em 4 seções organizadas

&#x20;  Cor primária via swatches grid



ONDA 3 — UX de compra (Xh)

✅ 3A: Minicart drawer auto-open

✅ 3B: Sacola sticky no header

✅ 3C: Related products no PDP

✅ 3D: Adicionar-e-continuar



ONDA 4 — Variantes com foto (Xh)

✅ 4A: Migration drizzle/00XX\_variant\_featured\_image.sql

✅ 4B: Selector de foto destacada no admin

✅ 4C: Troca foto principal ao selecionar variante

✅ 4D: Swatches no card



ONDA 5 — Editor de imagem (Xh)

✅ 5.1-5.7: <N commits>

&#x20;  Lib: react-easy-crop



ONDA 6 — Desktop responsivo (Xh)

✅ 6A: DesktopHeader

✅ 6B: Integração store-shell

✅ 6C: PDP 2 colunas

✅ 6D: Grid responsivo

✅ 6E: Sticky com colapso



ONDA 7 — Tradução (Xh)

✅ 7.1-7.4: <N commits>



ONDA 8 — Validação

✅ pnpm test: X/X verde

✅ pnpm lint: clean

✅ pnpm tsc: clean

✅ pnpm build: X.X kB First Load

✅ Smoke desktop + mobile passou



═══════════════════════════════════════════════════════════

TOTAL: XX commits, \~XXh

═══════════════════════════════════════════════════════════



ITENS DEPENDENTES DO ANDERSON (execute MANUALMENTE):



1\. ⚠️ APLICAR SQL 15 no Supabase Dashboard → SQL Editor:

&#x20;  Caminho: supabase/sql/15\_revoke\_anon\_grants.sql

&#x20;  CRÍTICO: revoga grants de anon/authenticated em tabelas public.

&#x20;  Sem isso, anon key permite ler/escrever via supabase-js direto.



2\. ⚠️ APLICAR migration nova de featured\_image\_id:

&#x20;  Via `pnpm db:push` ou Supabase Dashboard → SQL Editor.

&#x20;  Arquivo: drizzle/00XX\_<nome>.sql gerado nesta sessão.



3\. ⚠️ REDEPLOY na Vercel.



═══════════════════════════════════════════════════════════

ITENS PULADOS (com motivo):

<listar se houver>

═══════════════════════════════════════════════════════════

```



NÃO REDEPLOYA. Anderson redeploya manualmente.

NÃO APLICA SQLs em prod (sem rede no sandbox).

NÃO REFATORA product-form (fase pós-Stripe).

NÃO MEXE em feature flags, analytics, tracking SQL custom (fase 

pós-Stripe).



Começa pela ONDA 1. Vai.

