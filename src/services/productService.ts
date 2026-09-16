import type { Product, ProductFiltersState } from "../types";
import { api } from "./api";
import { slugify } from "../utils/format";

export interface ProductQuery {
  search?: string;
  category?: string; // slug
  subcategory?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: "all" | "in-stock" | "out-of-stock";
  sort?: string;
  sellerId?: string;
}

const toQuery = (q: ProductQuery) => {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
};

export const productService = {
  getProducts: (query: ProductQuery = {}) => api<{ products: Product[] }>(`/products${toQuery(query)}`).then((d) => d.products),
  getProductById: (id: string) => api<{ product: Product }>(`/products/${id}`).then((d) => d.product),
  searchProducts: (search: string) => productService.getProducts({ search }),
  getSuggestions: (query: string) =>
    api<{ suggestions: { id: string; label: string; meta: string }[] }>(`/products/suggestions?q=${encodeURIComponent(query)}`).then((d) => d.suggestions),
  addProduct: (product: Partial<Product>) => api<{ product: Product }>("/products", { method: "POST", body: product }).then((d) => d.product),
  updateProduct: (id: string, patch: Partial<Product>) => api<{ product: Product }>(`/products/${id}`, { method: "PUT", body: patch }).then((d) => d.product),
  updateStock: (id: string, stock: number) => api<{ product: Product }>(`/products/${id}/stock`, { method: "PATCH", body: { stock } }).then((d) => d.product),
  deleteProduct: (id: string) => api(`/products/${id}`, { method: "DELETE" }),
  uploadImages: async (files: File[]): Promise<string[]> => {
    if (!files.length) return [];
    const formData = new FormData();
    files.forEach((f) => formData.append("images", f));
    const data = await api<{ urls?: string[]; url?: string }>("/uploads", {
      method: "POST",
      formData
    });
    return data.urls || (data.url ? [data.url] : []);
  },
  categorySlugForProduct: (product: Product) => slugify(product.category)
};

/** Client-side filtering/sorting kept for the ProductListPage filter UI. */
export const filterProducts = (items: Product[], filters: ProductFiltersState) => {
  const term = filters.search.trim().toLowerCase();
  const matches = (p: Product) =>
    !term || [p.name, p.category, p.subcategory, p.brand, p.description, p.tags.join(" ")].join(" ").toLowerCase().includes(term);
  const filtered = items.filter((p) => {
    const ok =
      (!filters.category || p.category === filters.category) &&
      (!filters.subcategory || p.subcategory === filters.subcategory) &&
      (!filters.brand || p.brand === filters.brand) &&
      p.price >= filters.minPrice && p.price <= filters.maxPrice &&
      p.rating >= filters.rating &&
      (filters.availability === "all" || (filters.availability === "in-stock" && p.stock > 0) || (filters.availability === "out-of-stock" && p.stock === 0));
    return ok && matches(p);
  });
  return [...filtered].sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price;
    if (filters.sort === "price-desc") return b.price - a.price;
    if (filters.sort === "rating") return b.rating - a.rating;
    if (filters.sort === "newest") return Number(!!b.isNew) - Number(!!a.isNew);
    if (filters.sort === "popular") return b.reviewCount - a.reviewCount;
    return Number(!!b.isFeatured) - Number(!!a.isFeatured);
  });
};
