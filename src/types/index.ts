export type Role = "customer" | "seller" | "delivery" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories: string[];
  description: string;
  image: string;
  icon: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  subcategory: string;
  brand: string;
  images: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  sellerId: string;
  sellerName: string;
  specifications: Record<string, string>;
  tags: string[];
  isFeatured?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  isVirtualTryOnSupported: boolean;
  productType: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  name: string;
  phone: string;
  line1: string;
  city: string;
  region: string;
  postalCode: string;
}

export interface OrderItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | "Order Placed"
  | "Payment Confirmed"
  | "Processing"
  | "Dispatched"
  | "Shipped"
  | "Out for Delivery"
  | "Delivered";

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  date: string;
  paymentStatus: "Pending" | "Paid" | "Failed" | "Refunded";
  deliveryAddress: Address;
  status: OrderStatus;
  total: number;
}

export type ReturnStatus =
  | "Requested"
  | "Approved"
  | "Pickup Scheduled"
  | "Returned"
  | "Refund Processing"
  | "Refunded"
  | "Rejected";

export interface ReturnRequest {
  id: string;
  orderId: string;
  productId: string;
  reason: string;
  status: ReturnStatus;
  createdAt: string;
}

export interface TryOnResult {
  id: string;
  productId: string;
  productName: string;
  sourceImage: string;
  previewImage: string;
  size: string;
  color: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface ProductFiltersState {
  search: string;
  category: string;
  subcategory: string;
  brand: string;
  minPrice: number;
  maxPrice: number;
  rating: number;
  availability: "all" | "in-stock" | "out-of-stock";
  sort: "relevance" | "price-asc" | "price-desc" | "rating" | "newest" | "popular";
}
