import type { Address, Order, OrderStatus } from "../types";
import { api } from "./api";

export const orderTimeline: OrderStatus[] = [
  "Order Placed", "Payment Confirmed", "Processing", "Dispatched", "Shipped", "Out for Delivery", "Delivered"
];

export const orderService = {
  createRazorpayOrder: () =>
    api<{ order_id: string; amount: number; currency: string; key_id: string }>(
      "/orders/razorpay/create-order",
      { method: "POST" }
    ),
  verifyRazorpayPayment: (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api<{ verified: boolean }>("/orders/razorpay/verify-payment", { method: "POST", body: payment }),
  checkout: (address: Address, payment?: unknown) =>
    api<{ order: Order }>("/orders/checkout", { method: "POST", body: { address, payment } }).then((d) => d.order),
  getOrders: () => api<{ orders: Order[] }>("/orders").then((d) => d.orders),
  getUnassignedOrders: () => api<{ orders: Order[] }>("/orders?unassigned=true").then((d) => d.orders),
  claimOrder: (id: string) => api<{ order: Order }>(`/orders/${id}/claim`, { method: "POST" }).then((d) => d.order),
  getOrder: (id: string) => api<{ order: Order }>(`/orders/${id}`).then((d) => d.order),
  advanceStatus: (id: string) => api<{ order: Order }>(`/orders/${id}/advance`, { method: "POST" }).then((d) => d.order),
  nextStatus: (status: OrderStatus) => orderTimeline[Math.min(orderTimeline.indexOf(status) + 1, orderTimeline.length - 1)]
};
