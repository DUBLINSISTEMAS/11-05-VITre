/**
 * Categorias pré-populadas por nicho.
 * Criadas automaticamente no `createStore` para acelerar o time-to-value.
 * Lojista pode editar (renomear, remover, adicionar) depois no admin.
 */

export const NICHE_CATEGORIES: Record<string, readonly string[]> = {
  roupa_feminina: ["Vestidos", "Blusas", "Calças & Saias", "Acessórios"],
  joia: ["Anéis", "Brincos", "Colares", "Pulseiras"],
  semijoia: ["Anéis", "Brincos", "Colares", "Conjuntos"],
  perfumaria: ["Perfumes Importados", "Nacionais", "Body Splash"],
  outro: [],
} as const;

export const NICHE_OPTIONS = [
  { value: "roupa_feminina", label: "Roupa feminina" },
  { value: "joia", label: "Joia" },
  { value: "semijoia", label: "Semijoia" },
  { value: "perfumaria", label: "Perfumaria" },
  { value: "outro", label: "Outro" },
] as const;

export type NicheValue = (typeof NICHE_OPTIONS)[number]["value"];
