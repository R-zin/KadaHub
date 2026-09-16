import type { User } from "../types";
import { api } from "./api";

export interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  totalUsers?: number;
  activeUsers: number;
  sellers: number;
  products: number;
  lowStock: number;
  outOfStock?: number;
  pendingReturns: number;
}
export interface AdminUser extends User { isActive: boolean; createdAt: string }
export interface Transaction {
  id: string;
  orderId?: string;
  orderNumber: string;
  type: "charge" | "refund";
  status: string;
  amount: number;
  currency: string;
  reference: string;
  date: string;
}

export const adminService = {
  stats: () => api<{ stats: AdminStats }>("/admin/stats").then((d) => d.stats),
  getUsers: () => api<{ users: AdminUser[] }>("/admin/users").then((d) => d.users),
  setUserActive: (id: string, isActive: boolean) =>
    api<{ user: AdminUser }>(`/admin/users/${id}/active`, { method: "PATCH", body: { isActive } }).then((d) => d.user),
  categoryDistribution: () => api<{ distribution: { label: string; value: number }[] }>("/admin/categories/distribution").then((d) => d.distribution),
  getTransactions: () => api<{ transactions: Transaction[] }>("/admin/transactions").then((d) => d.transactions),
  getReports: () => api<{
    salesByDay: { day: string; orders: number; revenue: number }[];
    inventoryByCategory: { category: string; stock: number; products: number; outOfStock?: number; lowStock?: number }[];
  }>("/admin/reports")
};
