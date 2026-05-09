import { ProductDetailSkeleton } from "@/components/storefront/skeletons";

export default function ProductLoading() {
  return (
    <div className="px-4 py-6">
      <ProductDetailSkeleton />
    </div>
  );
}
