import type { Address, Order, OrderStatus } from "../types";
import { api } from "./api";

export const orderTimeline: OrderStatus[] = [
  "Order Placed", "Payment Confirmed", "Processing", "Dispatched", "Shipped", "Out for Delivery", "Delivered"
];

export const orderService = {
  checkout: (address: Address, payment?: unknown) =>
    api<{ order: Order }>("/orders/checkout", { method: "POST", body: { address, payment } }).then((d) => d.order),
  getOrders: () => api<{ orders: Order[] }>("/orders").then((d) => d.orders),
  getOrder: (id: string) => api<{ order: Order }>(`/orders/${id}`).then((d) => d.order),
  advanceStatus: (id: string) => api<{ order: Order }>(`/orders/${id}/advance`, { method: "POST" }).then((d) => d.order)
};
