import type { CartItem, Product } from "../types";

export const cartService = {
  addItem(items: CartItem[], product: Product, quantity = 1) {
    const existing = items.find((item) => item.product.id === product.id);
    if (existing) {
      return items.map((item) =>
        item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) } : item
      );
    }
    return [...items, { product, quantity: Math.min(quantity, Math.max(product.stock, 1)) }];
  },
  updateQuantity(items: CartItem[], productId: string, quantity: number) {
    return items.map((item) => (item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item));
  },
  removeItem(items: CartItem[], productId: string) {
    return items.filter((item) => item.product.id !== productId);
  },
  totals(items: CartItem[]) {
    const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const deliveryFee = subtotal > 100 || subtotal === 0 ? 0 : 8;
    const discount = subtotal > 500 ? subtotal * 0.08 : 0;
    return { subtotal, deliveryFee, discount, total: subtotal + deliveryFee - discount };
  }
};
