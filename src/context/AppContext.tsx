import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { cartService } from "../services/cartService";
import { categoryService } from "../services/categoryService";
import { notificationService } from "../services/notificationService";
import { orderService } from "../services/orderService";
import { productService, type ProductQuery } from "../services/productService";
import { returnService } from "../services/returnService";
import { tryOnService } from "../services/tryOnService";
import { wishlistService } from "../services/wishlistService";
import { clearToken, getToken } from "../services/api";
import type { Address, CartItem, Category, Notification, Order, Product, ReturnRequest, Role, TryOnResult, User } from "../types";

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  products: Product[];
  productsLoading: boolean;
  categories: Category[];
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  returns: ReturnRequest[];
  notifications: Notification[];
  savedTryOns: TryOnResult[];
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: Role, storeName?: string) => Promise<User>;
  logout: () => void;
  refreshProducts: (query?: ProductQuery) => Promise<void>;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (product: Product) => Promise<void>;
  checkout: (address: Address) => Promise<Order>;
  refreshOrders: () => Promise<void>;
  advanceOrderStatus: (orderId: string) => Promise<void>;
  addReturnRequest: (orderId: string, productId: string, reason: string) => Promise<void>;
  refreshReturns: () => Promise<void>;
  addProduct: (product: Partial<Product>) => Promise<Product>;
  updateProductStock: (productId: string, stock: number) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveTryOn: (result: TryOnResult) => void;
  generateTryOn: (product: Product, sourceImage: string, size: string, color: string) => Promise<TryOnResult>;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [savedTryOns, setSavedTryOns] = useState<TryOnResult[]>([]);

  // ---- loaders ------------------------------------------------------------
  const refreshProducts = useCallback(async (query?: ProductQuery) => {
    setProductsLoading(true);
    try { setProducts(await productService.getProducts(query)); }
    catch { /* keep existing */ } finally { setProductsLoading(false); }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!getToken()) return setOrders([]);
    try { setOrders(await orderService.getOrders()); } catch { setOrders([]); }
  }, []);

  const refreshReturns = useCallback(async () => {
    if (!getToken()) return setReturns([]);
    try { setReturns(await returnService.getReturns()); } catch { setReturns([]); }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!getToken()) return setNotifications([]);
    try { setNotifications(await notificationService.getAll()); } catch { setNotifications([]); }
  }, []);

  const loadPrivate = useCallback(async () => {
    if (!getToken()) {
      setCart([]); setWishlist([]); setOrders([]); setReturns([]); setNotifications([]); setSavedTryOns([]);
      return;
    }
    const [cartData, wishlistData, , , , tryOns] = await Promise.all([
      cartService.getCart().catch(() => []),
      wishlistService.getIds().catch(() => []),
      refreshOrders(), refreshReturns(), refreshNotifications(),
      tryOnService.getSaved().catch(() => [])
    ]);
    setCart(cartData);
    setWishlist(wishlistData);
    setSavedTryOns(tryOns);
  }, [refreshOrders, refreshReturns, refreshNotifications]);

  // ---- bootstrap: categories + products (public), then session ------------
  useEffect(() => {
    (async () => {
      try { setCategories(await categoryService.getCategories()); } catch { setCategories([]); }
      refreshProducts();
      if (getToken()) {
        try { setUser(await authService.me()); await loadPrivate(); }
        catch { clearToken(); setUser(null); }
      }
      setAuthLoading(false);
    })();
  }, [refreshProducts, loadPrivate]);

  // Force logout when the session expires (broadcast by the API client on 401).
  useEffect(() => {
    const onExpired = () => { setUser(null); setCart([]); setWishlist([]); setOrders([]); setReturns([]); setNotifications([]); setSavedTryOns([]); };
    window.addEventListener("kadahub:session-expired", onExpired);
    return () => window.removeEventListener("kadahub:session-expired", onExpired);
  }, []);

  // ---- auth ---------------------------------------------------------------
  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authService.login(email, password);
    setUser(user);
    await loadPrivate();
    return user;
  }, [loadPrivate]);

  const register = useCallback(async (name: string, email: string, password: string, role: Role, storeName?: string) => {
    const { user } = await authService.register(name, email, password, role, storeName);
    setUser(user);
    await loadPrivate();
    return user;
  }, [loadPrivate]);

  const logout = useCallback(() => {
    authService.logout();
    clearToken();
    setUser(null);
    setCart([]); setWishlist([]); setOrders([]); setReturns([]); setNotifications([]); setSavedTryOns([]);
  }, []);

  // ---- cart ---------------------------------------------------------------
  const addToCart = useCallback(async (product: Product, quantity = 1) => {
    setCart(await cartService.addItem(product.id, quantity));
  }, []);
  const updateCartQuantity = useCallback(async (productId: string, quantity: number) => {
    setCart(await cartService.updateQuantity(productId, quantity));
  }, []);
  const removeFromCart = useCallback(async (productId: string) => {
    setCart(await cartService.removeItem(productId));
  }, []);
  const clearCart = useCallback(async () => { setCart(await cartService.clear()); }, []);
  const toggleWishlist = useCallback(async (product: Product) => {
    setWishlist(await wishlistService.toggle(product.id));
  }, []);

  // ---- checkout / orders ----------------------------------------------------
  const checkout = useCallback(async (address: Address) => {
    const order = await orderService.checkout(address);
    setCart([]);
    await Promise.all([refreshOrders(), refreshProducts(), refreshNotifications()]);
    return order;
  }, [refreshOrders, refreshProducts, refreshNotifications]);

  const advanceOrderStatus = useCallback(async (orderId: string) => {
    await orderService.advanceStatus(orderId);
    await refreshOrders();
  }, [refreshOrders]);

  // ---- returns ---------------------------------------------------------------
  const addReturnRequest = useCallback(async (orderId: string, productId: string, reason: string) => {
    await returnService.request(orderId, productId, reason);
    await Promise.all([refreshReturns(), refreshNotifications()]);
  }, [refreshReturns, refreshNotifications]);

  // ---- products (seller/admin) ------------------------------------------------
  const addProduct = useCallback(async (product: Partial<Product>) => {
    const created = await productService.addProduct(product);
    await refreshProducts();
    return created;
  }, [refreshProducts]);
  const updateProductStock = useCallback(async (productId: string, stock: number) => {
    await productService.updateStock(productId, stock);
    await refreshProducts();
  }, [refreshProducts]);
  const deleteProduct = useCallback(async (productId: string) => {
    await productService.deleteProduct(productId);
    await refreshProducts();
  }, [refreshProducts]);

  // ---- try-on ------------------------------------------------------------------
  const saveTryOn = useCallback((result: TryOnResult) => setSavedTryOns((items) => [result, ...items]), []);
  const generateTryOn = useCallback(async (product: Product, sourceImage: string, size: string, color: string) => {
    const result = await tryOnService.generatePreview(product.id, sourceImage, size, color);
    setSavedTryOns((items) => [result, ...items]);
    return result;
  }, []);

  // ---- notifications -------------------------------------------------------------
  const markNotificationsRead = useCallback(async () => {
    setNotifications(await notificationService.markAllRead());
  }, []);
  const dismissNotification = useCallback(async (notificationId: string) => {
    setNotifications(await notificationService.dismiss(notificationId));
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user, authLoading, products, productsLoading, categories, cart, wishlist, orders, returns, notifications, savedTryOns,
    login, register, logout, refreshProducts, addToCart, updateCartQuantity, removeFromCart, clearCart, toggleWishlist,
    checkout, refreshOrders, advanceOrderStatus, addReturnRequest, refreshReturns, addProduct,
    updateProductStock, deleteProduct, saveTryOn, generateTryOn, refreshNotifications, markNotificationsRead, dismissNotification
  }), [user, authLoading, products, productsLoading, categories, cart, wishlist, orders, returns, notifications, savedTryOns,
    login, register, logout, refreshProducts, addToCart, updateCartQuantity, removeFromCart, clearCart, toggleWishlist,
    checkout, refreshOrders, advanceOrderStatus, addReturnRequest, refreshReturns, addProduct,
    updateProductStock, deleteProduct, saveTryOn, generateTryOn, refreshNotifications, markNotificationsRead, dismissNotification]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
};
