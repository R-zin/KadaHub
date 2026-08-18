import type { Order, Product, ReturnRequest, User } from "../types";

export const adminService = {
  stats: (products: Product[], orders: Order[], users: User[], returns: ReturnRequest[]) => ({
    totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
    totalOrders: orders.length,
    activeUsers: users.length + 128,
    sellers: 12,
    products: products.length,
    pendingReturns: returns.filter((item) => item.status !== "Refunded" && item.status !== "Rejected").length,
    lowStock: products.filter((product) => product.stock <= 20).length
  }),
  categoryDistribution: (products: Product[]) =>
    Object.entries(
      products.reduce<Record<string, number>>((acc, product) => {
        acc[product.category] = (acc[product.category] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([label, value]) => ({ label, value }))
};
