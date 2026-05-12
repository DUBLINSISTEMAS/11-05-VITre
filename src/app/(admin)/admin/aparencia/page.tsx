import { AdminPageHeader } from "@/components/admin/shell/page-header";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

export default async function AparenciaPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: aparencia page sem loja");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Aparência"
        subtitle="Escolha um modelo pronto pra sua vitrine. Cada modelo muda a forma das categorias, o estilo dos cards, o hero e a barra inferior."
      />

      <ThemeSelector
        currentTheme={{
          categoryShape: store.categoryShape,
          productCardStyle: store.productCardStyle,
          heroStyle: store.heroStyle,
          bottomNavStyle: store.bottomNavStyle,
        }}
      />
    </div>
  );
}
