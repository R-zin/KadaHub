import { categories } from "../data/categories";
import { products as initialProducts } from "../data/products";
import type { Product, ProductFiltersState } from "../types";
import { slugify } from "../utils/format";

let productStore = [...initialProducts];

const matchesSearch = (product: Product, search: string) => {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  return [product.name, product.category, product.subcategory, product.brand, product.description, product.tags.join(" ")]
    .join(" ")
    .toLowerCase()
    .includes(term);
};

export const productService = {
  getProducts: async () => productStore,
  getProductById: async (id: string) => productStore.find((product) => product.id === id),
  getProductsByCategory: async (categorySlug: string) => {
    const category = categories.find((item) => item.slug === categorySlug);
    return category ? productStore.filter((product) => product.category === category.name) : [];
  },
  searchProducts: async (query: string) => productStore.filter((product) => matchesSearch(product, query)),
  getSuggestions: (query: string) =>
    productStore
      .filter((product) => matchesSearch(product, query))
      .slice(0, 6)
      .map((product) => ({ id: product.id, label: product.name, meta: `${product.brand} · ${product.category}` })),
  filterProducts: (items: Product[], filters: ProductFiltersState) => {
    const filtered = items.filter((product) => {
      const categoryOk = !filters.category || product.category === filters.category;
      const subcategoryOk = !filters.subcategory || product.subcategory === filters.subcategory;
      const brandOk = !filters.brand || product.brand === filters.brand;
      const priceOk = product.price >= filters.minPrice && product.price <= filters.maxPrice;
      const ratingOk = product.rating >= filters.rating;
      const stockOk =
        filters.availability === "all" ||
        (filters.availability === "in-stock" && product.stock > 0) ||
        (filters.availability === "out-of-stock" && product.stock === 0);
      return categoryOk && subcategoryOk && brandOk && priceOk && ratingOk && stockOk && matchesSearch(product, filters.search);
    });

    return [...filtered].sort((a, b) => {
      if (filters.sort === "price-asc") return a.price - b.price;
      if (filters.sort === "price-desc") return b.price - a.price;
      if (filters.sort === "rating") return b.rating - a.rating;
      if (filters.sort === "newest") return Number(Boolean(b.isNew)) - Number(Boolean(a.isNew));
      if (filters.sort === "popular") return b.reviewCount - a.reviewCount;
      return Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
    });
  },
  addProduct: async (product: Omit<Product, "id" | "rating" | "reviewCount">) => {
    const next: Product = {
      ...product,
      id: `p${Date.now()}`,
      rating: 0,
      reviewCount: 0,
      isVirtualTryOnSupported: product.category === "Clothing" && product.isVirtualTryOnSupported
    };
    productStore = [next, ...productStore];
    return next;
  },
  updateProduct: async (id: string, patch: Partial<Product>) => {
    productStore = productStore.map((product) =>
      product.id === id
        ? {
            ...product,
            ...patch,
            isVirtualTryOnSupported:
              (patch.category ?? product.category) === "Clothing" && Boolean(patch.isVirtualTryOnSupported ?? product.isVirtualTryOnSupported)
          }
        : product
    );
    return productStore.find((product) => product.id === id);
  },
  deleteProduct: async (id: string) => {
    productStore = productStore.filter((product) => product.id !== id);
  },
  categorySlugForProduct: (product: Product) => slugify(product.category)
};
