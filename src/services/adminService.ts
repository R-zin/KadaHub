import type { User } from "../types";
import { api } from "./api";

export interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  totalUsers?: number;
  activeUsers: number;
  customers?: number;
  sellers: number;
  deliveryAgents?: number;
  admins?: number;
  products: number;
  lowStock: number;
  outOfStock?: number;
  totalReturns?: number;
  pendingReturns: number;
  refunds?: number;
  refundedAmount?: number;
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
  setUserRole: (id: string, role: string) =>
    api<{ user: AdminUser }>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }).then((d) => d.user),
  categoryDistribution: () => api<{ distribution: { label: string; value: number }[] }>("/admin/categories/distribution").then((d) => d.distribution),
  getTransactions: () => api<{ transactions: Transaction[] }>("/admin/transactions").then((d) => d.transactions),
  getReports: (params?: { startDate?: string; endDate?: string; days?: number }) => {
    const sp = new URLSearchParams();
    if (params?.startDate) sp.set("startDate", params.startDate);
    if (params?.endDate) sp.set("endDate", params.endDate);
    if (params?.days) sp.set("days", String(params.days));
    const qs = sp.toString() ? `?${sp.toString()}` : "";
    return api<{
      salesByDay: { date?: string; day: string; orders: number; revenue: number }[];
      inventoryByCategory: { category: string; stock: number; products: number; outOfStock?: number; lowStock?: number }[];
    }>(`/admin/reports${qs}`);
  }
};
