import { Route, Routes } from "react-router-dom";
import { AppLayout, ProtectedRoute } from "./layouts/AppLayout";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { CartPage } from "./pages/CartPage";
import { CategoryPage } from "./pages/CategoryPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { DeliveryPage } from "./pages/DeliveryPage";
import { HomePage } from "./pages/HomePage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductListPage } from "./pages/ProductListPage";
import { SellerPage } from "./pages/SellerPage";
import { TryOnPage } from "./pages/TryOnPage";
import { WishlistPage } from "./pages/WishlistPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="category/:categorySlug" element={<CategoryPage />} />
        <Route path="search" element={<ProductListPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
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
  );
}
