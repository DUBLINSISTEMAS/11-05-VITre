import { AppearanceForm } from "@/components/admin/appearance-form";
import { ThemeSelector } from "@/components/admin/theme-selector";
import { requireSession } from "@/lib/auth-server";
import { getCurrentStore } from "@/lib/store-context";

/**
 * Aparência — Onda A.13 pixel-perfect Dublin v3.
 *
 * Handoff Dublin v3 não tem screen 1:1 de "Aparência" — esta é tela Vitrê
 * própria (themes + brand). Aplicamos chrome canônico: H1 22px font-bold
 * tracking -0.025em + section header upper 11px (padrão Aparência/Pagamento).
 */
export default async function AparenciaPage() {
  const session = await requireSession();
  const store = await getCurrentStore(session.user.id);
  if (!store) {
    throw new Error("UNREACHABLE: aparencia page sem loja");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Aparência
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Modelo da vitrine, logo, ícone, cor e como o carrossel de banners
          se comporta.
        </p>
      </div>

      <section className="space-y-3">
        <header>
          <div className="text-ink-4 text-[11px] font-bold uppercase tracking-[0.06em]">
            Modelo da vitrine
          </div>
          <p className="text-ink-4 mt-1 text-xs leading-relaxed">
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
