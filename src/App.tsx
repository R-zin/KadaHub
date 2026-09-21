import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout, ProtectedRoute } from "./layouts/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingState } from "./components/ui";

const AccountPage = lazy(() => import("./pages/AccountPage").then((m) => ({ default: m.AccountPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const AuthPage = lazy(() => import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const CartPage = lazy(() => import("./pages/CartPage").then((m) => ({ default: m.CartPage })));
const CategoryPage = lazy(() => import("./pages/CategoryPage").then((m) => ({ default: m.CategoryPage })));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage").then((m) => ({ default: m.CheckoutPage })));
const DeliveryPage = lazy(() => import("./pages/DeliveryPage").then((m) => ({ default: m.DeliveryPage })));
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const OrdersPage = lazy(() => import("./pages/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })));
const ProductListPage = lazy(() => import("./pages/ProductListPage").then((m) => ({ default: m.ProductListPage })));
const SellerPage = lazy(() => import("./pages/SellerPage").then((m) => ({ default: m.SellerPage })));
const TryOnPage = lazy(() => import("./pages/TryOnPage").then((m) => ({ default: m.TryOnPage })));
const WishlistPage = lazy(() => import("./pages/WishlistPage").then((m) => ({ default: m.WishlistPage })));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><LoadingState label="Loading page..." /></div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductListPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="category/:categorySlug" element={<CategoryPage />} />
            <Route path="search" element={<ProductListPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<ProtectedRoute roles={["customer"]}><CheckoutPage /></ProtectedRoute>} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="try-on/:productId" element={<TryOnPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route path="forgot-password" element={<AuthPage mode="forgot" />} />
            <Route path="seller/*" element={<ProtectedRoute roles={["seller", "admin"]}><SellerPage /></ProtectedRoute>} />
            <Route path="delivery/*" element={<ProtectedRoute roles={["delivery", "admin"]}><DeliveryPage /></ProtectedRoute>} />
            <Route path="admin/*" element={<ProtectedRoute roles={["admin"]}><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={<ProductListPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
