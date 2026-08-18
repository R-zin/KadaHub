import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductFilters, defaultFilters } from "../components/ProductFilters";
import { ProductGrid } from "../components/ProductGrid";
import { Button, Modal } from "../components/ui";
import { productService } from "../services/productService";
import { useApp } from "../context/AppContext";
import type { ProductFiltersState } from "../types";

export const ProductListPage = () => {
  const { products } = useApp();
  const [params] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFiltersState>({ ...defaultFilters, search: params.get("q") ?? "" });
  const visible = useMemo(() => productService.filterProducts(products, filters), [products, filters]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-950">All Products</h1>
          <p className="mt-2 text-slate-500">Search and filter across electronics, clothing, home, beauty, sports, books, grocery, and more.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as ProductFiltersState["sort"] })}>
            <option value="relevance">Relevance</option>
            <option value="price-asc">Price Low to High</option>
            <option value="price-desc">Price High to Low</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
            <option value="popular">Popular</option>
          </select>
          <Button variant="secondary" className="lg:hidden" onClick={() => setFilterOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Filters</Button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block"><ProductFilters filters={filters} setFilters={setFilters} products={products} /></div>
        <ProductGrid products={visible} />
      </div>
      {filterOpen && <Modal title="Filters" onClose={() => setFilterOpen(false)}><ProductFilters compact filters={filters} setFilters={setFilters} products={products} /></Modal>}
    </div>
  );
};
