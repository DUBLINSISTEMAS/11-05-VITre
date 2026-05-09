import { 
  BannerCarouselSkeleton, 
  CategoryPillsSkeleton, 
  ProductGridSkeleton,
  SectionHeaderSkeleton 
} from "@/components/storefront/skeletons";

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      {/* Banner */}
      <BannerCarouselSkeleton />
      
      {/* Category pills */}
      <CategoryPillsSkeleton count={6} />
      
      {/* Featured section */}
      <div className="space-y-4">
        <SectionHeaderSkeleton />
        <ProductGridSkeleton count={4} />
      </div>
      
      {/* New arrivals section */}
      <div className="space-y-4">
        <SectionHeaderSkeleton />
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
