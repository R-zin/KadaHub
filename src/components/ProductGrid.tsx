import type { Product } from "../types";
import { EmptyState } from "./ui";
import { ProductCard } from "./ProductCard";

export const ProductGrid = ({ products, loading }: { products: Product[]; loading?: boolean }) => {
  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
            <div className="aspect-square w-full rounded-lg bg-slate-200" />
            <div className="mt-3 space-y-2">
              <div className="h-3 w-16 rounded bg-slate-200" />
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-5 w-20 rounded bg-slate-200" />
                <div className="h-8 w-8 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return <EmptyState title="No products found" message="Try a different search, category, price range, or availability filter." />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
};
