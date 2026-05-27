import {
  CategoryStripSkeleton,
  HeroCardSkeleton,
  ProductGridSkeleton,
  SectionHeaderSkeleton,
} from "@/components/storefront/skeletons";

export default function HomeLoading() {
  return (
    <div className="space-y-7 lg:space-y-12">
      {/* Banner / hero — primeira dobra */}
      <HeroCardSkeleton />

      {/* Categorias (subiu pra pos 2 na Onda 7) */}
      <section className="space-y-2">
        <div className="h-6 w-24 animate-pulse rounded-md bg-gray-200" />
        <CategoryStripSkeleton count={6} />
      </section>

      {/* Em destaque */}
      <div className="space-y-3">
        <SectionHeaderSkeleton />
        <ProductGridSkeleton count={4} />
      </div>

      {/* More */}
      <ProductGridSkeleton count={2} />
    </div>
  );
}
