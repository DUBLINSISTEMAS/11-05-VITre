// Tipos exportados do módulo brand — separados das actions pra obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.

export interface BrandListRow {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Subset usado no Select do product-form (id + name). */
export interface BrandOption {
  id: string;
  name: string;
}
