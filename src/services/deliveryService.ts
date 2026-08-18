import type { Order } from "../types";

export const deliveryService = {
  assignedOrders: (orders: Order[]) => orders.filter((order) => order.status !== "Delivered"),
  stats: (orders: Order[]) => ({
    assigned: orders.length,
    pending: orders.filter((order) => order.status === "Processing" || order.status === "Dispatched").length,
    outForDelivery: orders.filter((order) => order.status === "Out for Delivery").length,
    delivered: orders.filter((order) => order.status === "Delivered").length,
    failed: 1
  })
};
