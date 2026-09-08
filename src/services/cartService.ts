import type { CartItem } from "../types";
import { api } from "./api";

/** Server-backed cart. Each mutator returns the fresh cart from the API. */
export const cartService = {
  getCart: () => api<{ cart: CartItem[] }>("/cart").then((d) => d.cart),
  addItem: (productId: string, quantity = 1) =>
    api<{ cart: CartItem[] }>("/cart/items", { method: "POST", body: { productId, quantity } }).then((d) => d.cart),
  updateQuantity: (productId: string, quantity: number) =>
    api<{ cart: CartItem[] }>(`/cart/items/${productId}`, { method: "PATCH", body: { quantity } }).then((d) => d.cart),
  removeItem: (productId: string) => api<{ cart: CartItem[] }>(`/cart/items/${productId}`, { method: "DELETE" }).then((d) => d.cart),
  clear: () => api<{ cart: CartItem[] }>("/cart", { method: "DELETE" }).then((d) => d.cart),
  /** Pricing rules mirror the backend; used only for display before checkout. */
  totals(items: CartItem[]) {
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliveryFee = subtotal > 100 || subtotal === 0 ? 0 : 8;
    const discount = subtotal > 500 ? subtotal * 0.08 : 0;
    return { subtotal, deliveryFee, discount, total: subtotal + deliveryFee - discount };
  }
};
