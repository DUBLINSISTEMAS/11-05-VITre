// Tipos exportados do módulo attribute — separados de load.ts para obedecer
// a regra do Next 15: arquivo "use server" só pode exportar funções async.

export type AttributeWithValues = {
  id: string;
  name: string;
  type: "color" | "size" | "text";
  position: number;
  isActive: boolean;
  values: {
    id: string;
    label: string;
    colorHex: string | null;
    position: number;
  }[];
};
