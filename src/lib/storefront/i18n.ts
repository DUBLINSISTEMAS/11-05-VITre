/**
 * Sistema de internacionalização simples para o storefront.
 * Centraliza todos os textos em português brasileiro.
 */

export const t = {
  // Navigation
  nav: {
    home: "Início",
    explore: "Explorar",
    favorites: "Favoritos",
    profile: "Perfil",
    cart: "Sacola",
    back: "Voltar",
    seeAll: "Ver todos",
    viewAll: "Ver tudo",
  },

  // Search
  search: {
    placeholder: "Buscar produtos...",
    title: "Explorar",
    allProducts: "Todos os Produtos",
    results: "Resultados",
    resultsFor: "Resultados para",
    noResults: "Nenhum produto encontrado",
    tryAgain: "Tente buscar por outro termo",
    searching: "Buscando...",
  },

  // Product
  product: {
    details: "Detalhes",
    description: "Descrição",
    selectSize: "Selecione o Tamanho",
    sizeChart: "Guia de Tamanhos",
    selectVariant: "Selecione uma opção",
    addToCart: "Adicionar à Sacola",
    adding: "Adicionando...",
    added: "Adicionado!",
    buyNow: "Comprar Agora",
    share: "Compartilhar",
    favorite: "Favoritar",
    unfavorite: "Remover dos favoritos",
    outOfStock: "Esgotado",
    inStock: "Em estoque",
    lowStock: "Últimas unidades",
    from: "A partir de",
    learnMore: "Saiba mais",
    noPhoto: "Sem foto",
  },

  // Sections
  sections: {
    specialForYou: "Especial Para Você",
    newArrivals: "Novidades",
    featured: "Destaques",
    categories: "Categorias",
    allProducts: "Todos os Produtos",
    recommended: "Recomendados",
    onSale: "Em Promoção",
    bestSellers: "Mais Vendidos",
  },

  // Banner / Promo
  promo: {
    superSale: "Super Oferta",
    discount: "Desconto",
    upTo: "Até",
    off: "OFF",
    shopNow: "Comprar Agora",
    limitedTime: "Por tempo limitado",
    freeShipping: "Frete Grátis",
  },

  // Cart
  cart: {
    title: "Sua Sacola",
    empty: "Sua sacola está vazia",
    emptyDescription: "Adicione produtos para continuar",
    continueShopping: "Continuar Comprando",
    checkout: "Finalizar Pedido",
    subtotal: "Subtotal",
    total: "Total",
    remove: "Remover",
    quantity: "Quantidade",
    item: "item",
    items: "itens",
  },

  // Favorites
  favorites: {
    title: "Favoritos",
    empty: "Nenhum favorito ainda",
    emptyDescription: "Toque no coração para salvar produtos",
    addedToFavorites: "Adicionado aos favoritos",
    removedFromFavorites: "Removido dos favoritos",
  },

  // Profile
  profile: {
    title: "Perfil",
    guest: "Visitante",
    hello: "Olá",
    orders: "Meus Pedidos",
    addresses: "Endereços",
    help: "Ajuda",
    about: "Sobre a Loja",
    contact: "Contato",
    terms: "Termos de Uso",
    privacy: "Privacidade",
  },

  // Categories
  categories: {
    all: "Todos",
    allProducts: "Todos os Produtos",
    viewCategory: "Ver categoria",
  },

  // Actions / Feedback
  actions: {
    loading: "Carregando...",
    tryAgain: "Tentar novamente",
    close: "Fechar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    save: "Salvar",
    edit: "Editar",
    delete: "Excluir",
    share: "Compartilhar",
    copy: "Copiar",
    copied: "Copiado!",
  },

  // Errors
  errors: {
    generic: "Algo deu errado",
    tryAgain: "Tente novamente",
    notFound: "Não encontrado",
    offline: "Sem conexão",
  },

  // Accessibility
  a11y: {
    openMenu: "Abrir menu",
    closeMenu: "Fechar menu",
    openCart: "Abrir sacola",
    openSearch: "Abrir busca",
    productImage: "Imagem do produto",
    slideOf: "Slide {current} de {total}",
    goToSlide: "Ir para slide {n}",
    previousSlide: "Slide anterior",
    nextSlide: "Próximo slide",
  },
} as const;

// Helper para pluralização simples
export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

// Helper para formatar preço em BRL
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

// Helper para formatar desconto
export function formatDiscount(originalPrice: number, currentPrice: number): string {
  const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  return `${discount}% OFF`;
}
