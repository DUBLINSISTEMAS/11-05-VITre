import { loadCoupons } from "@/actions/coupon";
import { CouponsManager } from "@/components/admin/coupons-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CuponsPage() {
  await requireSession();
  const coupons = await loadCoupons();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* S22 (handoff pixel-perfect 2026-05-25): h1+sub viram b3-page-title +
          b3-page-sub (handoff stub-pages.jsx:174 "Códigos de desconto"). */}
      <div>
        <h1 className="b3-page-title">Códigos de desconto</h1>
        <p className="b3-page-sub">
          Códigos de desconto para campanhas. Aplicados no PDV ou combinados
          via WhatsApp.
        </p>
      </div>

      <CouponsManager initialCoupons={coupons} />
    </div>
  );
}
