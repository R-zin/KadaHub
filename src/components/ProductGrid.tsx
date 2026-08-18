import type { Product } from "../types";
import { EmptyState } from "./ui";
import { ProductCard } from "./ProductCard";

export const ProductGrid = ({ products }: { products: Product[] }) => {
  if (!products.length) {
    return <EmptyState title="No products found" message="Try a different search, category, price range, or availability filter." />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
};
