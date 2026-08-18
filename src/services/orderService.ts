import type { Address, CartItem, Order, OrderStatus, ReturnRequest } from "../types";
import { cartService } from "./cartService";

export const orderTimeline: OrderStatus[] = [
  "Order Placed",
  "Payment Confirmed",
  "Processing",
  "Dispatched",
  "Shipped",
  "Out for Delivery",
  "Delivered"
];

export const orderService = {
  createOrder: async (items: CartItem[], address: Address): Promise<Order> => {
    const totals = cartService.totals(items);
    return {
      id: `order-${Date.now()}`,
      orderNumber: `EC${Math.floor(10000 + Math.random() * 89999)}`,
      items: items.map((item) => ({ product: item.product, quantity: item.quantity })),
      date: new Date().toISOString(),
      paymentStatus: "Paid",
      deliveryAddress: address,
      status: "Payment Confirmed",
      total: totals.total
    };
  },
  nextStatus: (status: OrderStatus) => orderTimeline[Math.min(orderTimeline.indexOf(status) + 1, orderTimeline.length - 1)],
  createReturnRequest: (orderId: string, productId: string, reason: string): ReturnRequest => ({
    id: `return-${Date.now()}`,
    orderId,
    productId,
    reason,
    status: "Requested",
    createdAt: new Date().toISOString()
  })
};
