import { Filter } from "lucide-react";
import { categories } from "../data/categories";
import type { Product, ProductFiltersState } from "../types";
import { Button } from "./ui";

export const defaultFilters: ProductFiltersState = {
  search: "",
  category: "",
  subcategory: "",
  brand: "",
  minPrice: 0,
  maxPrice: 1500,
  rating: 0,
  availability: "all",
  sort: "relevance"
};

export const ProductFilters = ({
  filters,
  setFilters,
  products,
  compact = false
}: {
  filters: ProductFiltersState;
  setFilters: (filters: ProductFiltersState) => void;
  products: Product[];
  compact?: boolean;
}) => {
  const brands = Array.from(new Set(products.map((product) => product.brand))).sort();
  const activeCategory = categories.find((category) => category.name === filters.category);

  const update = (patch: Partial<ProductFiltersState>) => setFilters({ ...filters, ...patch });

  return (
    <aside className={`${compact ? "" : "sticky top-24"} rounded-lg border border-slate-200 bg-white p-4 shadow-sm`}>
      <div className="mb-4 flex items-center gap-2 font-semibold">
        <Filter className="h-5 w-5" /> Filters
      </div>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Search
          <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.search} onChange={(event) => update({ search: event.target.value })} placeholder="phone, shirt, chair" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.category} onChange={(event) => update({ category: event.target.value, subcategory: "" })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Subcategory
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.subcategory} onChange={(event) => update({ subcategory: event.target.value })}>
            <option value="">All subcategories</option>
            {(activeCategory?.subcategories ?? []).map((subcategory) => <option key={subcategory} value={subcategory}>{subcategory}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Brand
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.brand} onChange={(event) => update({ brand: event.target.value })}>
            <option value="">All brands</option>
            {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Min
            <input type="number" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.minPrice} onChange={(event) => update({ minPrice: Number(event.target.value) })} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Max
            <input type="number" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.maxPrice} onChange={(event) => update({ maxPrice: Number(event.target.value) })} />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Rating
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.rating} onChange={(event) => update({ rating: Number(event.target.value) })}>
            <option value={0}>Any rating</option>
            <option value={4}>4 stars and up</option>
            <option value={4.5}>4.5 stars and up</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Availability
          <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={filters.availability} onChange={(event) => update({ availability: event.target.value as ProductFiltersState["availability"] })}>
            <option value="all">All</option>
            <option value="in-stock">In stock</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </label>
        <Button variant="secondary" className="w-full" onClick={() => setFilters(defaultFilters)}>Reset Filters</Button>
      </div>
    </aside>
  );
};
