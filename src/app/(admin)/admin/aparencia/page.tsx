import { AppearanceForm } from "@/components/admin/appearance-form";
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
        subtitle="Modelo da vitrine, logo, ícone, cor e como o carrossel de banners se comporta."
      />

      <section className="space-y-2">
        <header className="px-1">
          <h2 className="text-[13.5px] font-semibold tracking-tight text-ink-1">
            Modelo da vitrine
          </h2>
          <p className="text-ink-4 text-xs leading-relaxed">
            Cada modelo muda a forma das categorias, o estilo dos cards, o
            hero e a barra inferior.
          </p>
        </header>
        <ThemeSelector
          currentTheme={{
            categoryShape: store.categoryShape,
            productCardStyle: store.productCardStyle,
            heroStyle: store.heroStyle,
            bottomNavStyle: store.bottomNavStyle,
          }}
        />
      </section>

      <AppearanceForm
        initialData={{
          primaryColor: store.primaryColor,
          bannerRotationSec: store.bannerRotationSec,
          logoUrl: store.logoUrl,
          iconUrl: store.iconUrl,
        }}
      />
    </div>
  );
}
