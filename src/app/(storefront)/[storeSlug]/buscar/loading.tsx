import { 
  ProductGridSkeleton,
  SearchBarSkeleton,
  SectionHeaderSkeleton 
} from "@/components/storefront/skeletons";

export default function SearchLoading() {
  return (
    <div className="space-y-6">
      {/* Search bar */}
      <SearchBarSkeleton />
      
      {/* Section header */}
      <SectionHeaderSkeleton />
      
      {/* Products grid */}
      <ProductGridSkeleton count={8} />
    </div>
  );
}
