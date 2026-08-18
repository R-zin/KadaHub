import { createContext, useContext, useMemo, useState } from "react";
import { products as initialProducts } from "../data/products";
import { mockOrders } from "../data/orders";
import { demoAccounts } from "../services/authService";
import { cartService } from "../services/cartService";
import { notificationService } from "../services/notificationService";
import { orderService } from "../services/orderService";
import { paymentService } from "../services/paymentService";
import { tryOnService } from "../services/tryOnService";
import type { Address, CartItem, Notification, Order, Product, ReturnRequest, Role, TryOnResult, User } from "../types";

interface AppContextValue {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  returns: ReturnRequest[];
  notifications: Notification[];
  savedTryOns: TryOnResult[];
  login: (role: Role) => void;
  register: (name: string, email: string, role: Role) => void;
  logout: () => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleWishlist: (product: Product) => void;
  checkout: (address: Address) => Promise<Order>;
  addReturnRequest: (orderId: string, productId: string, reason: string) => void;
  addProduct: (product: Omit<Product, "id" | "rating" | "reviewCount">) => void;
  updateProductStock: (productId: string, stock: number) => void;
  deleteProduct: (productId: string) => void;
  updateOrderStatus: (orderId: string) => void;
  saveTryOn: (result: TryOnResult) => void;
  generateTryOn: (product: Product, sourceImage: string, size: string, color: string) => Promise<TryOnResult>;
  markNotificationsRead: () => void;
  dismissNotification: (notificationId: string) => void;
  pushNotification: (message: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(demoAccounts[0]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([
    { product: initialProducts[1], quantity: 1 },
    { product: initialProducts[10], quantity: 1 },
    { product: initialProducts[22], quantity: 1 },
    { product: initialProducts[40], quantity: 1 }
  ]);
  const [wishlist, setWishlist] = useState<string[]>(["p003", "p011", "p021"]);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [savedTryOns, setSavedTryOns] = useState<TryOnResult[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([
    notificationService.create("Order #EC10234 confirmed"),
    notificationService.create("Your order has been shipped"),
    notificationService.create("Selected clothing now supports Virtual Try-On")
  ]);

  const pushNotification = (message: string) => {
    setNotifications((items) => [notificationService.create(message), ...items].slice(0, 12));
  };

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      products,
      cart,
      wishlist,
      orders,
      returns,
      notifications,
      savedTryOns,
      login: (role) => {
        const account = demoAccounts.find((item) => item.role === role) ?? demoAccounts[0];
        setUser(account);
        pushNotification(`Signed in as ${account.name}`);
      },
      register: (name, email, role) => {
        const account = { id: `u-${Date.now()}`, name, email, role };
        setUser(account);
        pushNotification("Account created successfully");
      },
      logout: () => {
        setUser(null);
        pushNotification("Signed out");
      },
      addToCart: (product, quantity = 1) => {
        setCart((items) => cartService.addItem(items, product, quantity));
        pushNotification(`${product.name} added to cart`);
      },
      updateCartQuantity: (productId, quantity) => setCart((items) => cartService.updateQuantity(items, productId, quantity)),
      removeFromCart: (productId) => setCart((items) => cartService.removeItem(items, productId)),
      clearCart: () => setCart([]),
      toggleWishlist: (product) => {
        setWishlist((items) => (items.includes(product.id) ? items.filter((id) => id !== product.id) : [...items, product.id]));
        pushNotification(`${product.name} ${wishlist.includes(product.id) ? "removed from" : "added to"} wishlist`);
      },
      checkout: async (address) => {
        await paymentService.verifyStock(cart);
        await paymentService.processPayment();
        const order = await orderService.createOrder(cart, address);
        setOrders((items) => [order, ...items]);
        setProducts((items) =>
          items.map((product) => {
            const cartItem = cart.find((item) => item.product.id === product.id);
            return cartItem ? { ...product, stock: Math.max(product.stock - cartItem.quantity, 0) } : product;
          })
        );
        setCart([]);
        pushNotification(`Order #${order.orderNumber} confirmed`);
        return order;
      },
      addReturnRequest: (orderId, productId, reason) => {
        setReturns((items) => [orderService.createReturnRequest(orderId, productId, reason), ...items]);
        pushNotification("Return request submitted");
      },
      addProduct: (product) => {
        const next = {
          ...product,
          id: `p${Date.now()}`,
          rating: 0,
          reviewCount: 0,
          isVirtualTryOnSupported: product.category === "Clothing" && product.isVirtualTryOnSupported
        };
        setProducts((items) => [next, ...items]);
        pushNotification("New seller product added");
      },
      updateProductStock: (productId, stock) =>
        setProducts((items) => items.map((product) => (product.id === productId ? { ...product, stock } : product))),
      deleteProduct: (productId) => setProducts((items) => items.filter((product) => product.id !== productId)),
      updateOrderStatus: (orderId) => {
        setOrders((items) =>
          items.map((order) => (order.id === orderId ? { ...order, status: orderService.nextStatus(order.status) } : order))
        );
        pushNotification("Delivery status updated");
      },
      saveTryOn: (result) => {
        setSavedTryOns((items) => [result, ...items]);
        pushNotification("Try-On result saved");
      },
      generateTryOn: (product, sourceImage, size, color) => tryOnService.generatePreview(product, sourceImage, size, color),
      markNotificationsRead: () => setNotifications((items) => items.map((item) => ({ ...item, read: true }))),
      dismissNotification: (notificationId) => setNotifications((items) => items.filter((item) => item.id !== notificationId)),
      pushNotification
    }),
    [cart, notifications, orders, products, returns, savedTryOns, user, wishlist]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};
