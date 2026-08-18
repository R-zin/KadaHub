import type { Address, Order } from "../types";
import { products } from "./products";

export const defaultAddress: Address = {
  name: "Maya Customer",
  phone: "+1 555 0188",
  line1: "42 Market Street",
  city: "San Francisco",
  region: "CA",
  postalCode: "94105"
};

export const mockOrders: Order[] = [
  {
    id: "order-seed-1",
    orderNumber: "EC10234",
    items: [
      { product: products[1], quantity: 1 },
      { product: products[10], quantity: 2 },
      { product: products[22], quantity: 1 }
    ],
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    paymentStatus: "Paid",
    deliveryAddress: defaultAddress,
    status: "Shipped",
    total: products[1].price + products[10].price * 2 + products[22].price
  },
  {
    id: "order-seed-2",
    orderNumber: "EC10351",
    items: [
      { product: products[40], quantity: 1 },
      { product: products[46], quantity: 3 }
    ],
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    paymentStatus: "Paid",
    deliveryAddress: defaultAddress,
    status: "Delivered",
    total: products[40].price + products[46].price * 3
  }
];
