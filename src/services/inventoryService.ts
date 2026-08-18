import type { Product } from "../types";

export const inventoryService = {
  lowStock: (products: Product[]) => products.filter((product) => product.stock > 0 && product.stock <= 20),
  outOfStock: (products: Product[]) => products.filter((product) => product.stock === 0)
};
