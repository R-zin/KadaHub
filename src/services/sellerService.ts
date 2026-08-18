import type { Order, Product } from "../types";

export const sellerService = {
  stats: (products: Product[], orders: Order[]) => {
    const sellerProducts = products.filter((product) => product.sellerId === "s4" || product.sellerId === "s5");
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    return {
      totalSales: orders.length,
      orders: orders.length,
      products: sellerProducts.length,
      lowStock: sellerProducts.filter((product) => product.stock <= 20).length,
      revenue
    };
  }
};
