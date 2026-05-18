import { loadCoupons } from "@/actions/coupon";
import { CouponsManager } from "@/components/admin/coupons-manager";
import { requireSession } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function CuponsPage() {
  await requireSession();
  const coupons = await loadCoupons();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-ink-1 text-[22px] font-bold tracking-[-0.025em]">
          Cupons
        </h1>
        <p className="text-ink-4 mt-1 text-[13px]">
          Códigos de desconto para campanhas. Aplicados no PDV ou combinados
          via WhatsApp.
        </p>
      </div>

      <CouponsManager initialCoupons={coupons} />
    </div>
  );
}
