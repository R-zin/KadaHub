import { Bell, Heart, Menu, Package, Search, ShoppingCart, User, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { categories } from "../data/categories";
import { productService } from "../services/productService";
import { useApp } from "../context/AppContext";
import { Badge, IconButton } from "../components/ui";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-100"}`;

export const AppLayout = () => {
  const { cart, wishlist, user, notifications, markNotificationsRead, dismissNotification } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const suggestions = productService.getSuggestions(query);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    setShowSuggestions(false);
  };

  const quickLinks = (
    <>
      <NavLink className={navLink} to="/products">Products</NavLink>
      <NavLink className={navLink} to="/orders">Orders</NavLink>
      <NavLink className={navLink} to="/account">Account</NavLink>
      {user?.role === "seller" && <NavLink className={navLink} to="/seller">Seller</NavLink>}
      {user?.role === "delivery" && <NavLink className={navLink} to="/delivery">Delivery</NavLink>}
      {user?.role === "admin" && <NavLink className={navLink} to="/admin">Admin</NavLink>}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <IconButton label="Menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <Link to="/" className="flex items-center gap-2 text-xl font-black text-slate-950">
            <img src="/kadahub-logo.png" alt="KadaHub logo" className="h-12 w-auto shrink-0 object-contain" />
            KadaHub
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">{quickLinks}</nav>
          <form onSubmit={submit} className="relative ml-auto hidden w-full max-w-md md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm"
              placeholder="Search phone, shirt, chair, books..."
              aria-label="Search products"
            />
            {showSuggestions && query && suggestions.length > 0 && (
              <div className="absolute mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      navigate(`/products/${suggestion.id}`);
                      setShowSuggestions(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-semibold text-slate-950">{suggestion.label}</span>
                    <span className="block text-xs text-slate-500">{suggestion.meta}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
          <div className="flex items-center gap-2">
            <Link to="/wishlist" aria-label="Wishlist" className="relative hidden h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:inline-flex">
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-xs font-bold text-white">{wishlist.length}</span>}
            </Link>
            <Link to="/cart" aria-label="Cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <ShoppingCart className="h-5 w-5" />
              {cart.length > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white">{cart.length}</span>}
            </Link>
            <button
              className="relative hidden h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:inline-flex"
              aria-label="Notifications"
              onClick={() => {
                setShowNotifications(!showNotifications);
                markNotificationsRead();
              }}
            >
              <Bell className="h-5 w-5" />
              {notifications.some((item) => !item.read) && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-600" />}
            </button>
            <Link to={user ? "/account" : "/login"} className="hidden items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:flex">
              <User className="h-4 w-4" /> {user ? user.name.split(" ")[0] : "Login"}
            </Link>
          </div>
          {showNotifications && (
            <div className="absolute right-4 top-16 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">Notifications</h3>
                <Badge tone="primary">{notifications.length}</Badge>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {notifications.length ? notifications.map((item) => (
                  <div key={item.id} className="relative rounded-md bg-slate-50 p-3 pr-10 text-sm text-slate-700">
                    <p>{item.message}</p>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      title="Dismiss notification"
                      className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-950"
                      onClick={(event) => {
                        event.stopPropagation();
                        dismissNotification(item.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )) : <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">No notifications</p>}
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 bg-white">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 text-sm scrollbar-thin">
            {categories.map((category) => (
              <Link key={category.id} to={`/category/${category.slug}`} className="whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950">
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
          <aside className="h-full w-80 max-w-[85vw] bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-bold"> <img src="/kadahub-logo.png" alt="KadaHub logo" className="h-10 w-auto shrink-0 object-contain" /> KadaHub </span>
              <IconButton label="Close menu" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></IconButton>
            </div>
            <form onSubmit={submit} className="mt-4">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2" placeholder="Search products" />
            </form>
            <nav className="mt-4 grid gap-2" onClick={() => setMobileOpen(false)}>{quickLinks}</nav>
          </aside>
        </div>
      )}
      <main>
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-black"> <img src="/kadahub-logo.png" alt="KadaHub logo" className="h-10 w-auto shrink-0 object-contain" /> KadaHub </div>
            <p className="mt-3 text-sm text-slate-500">A complete marketplace for shopping, selling, delivery, and platform operations.</p>
          </div>
          {["Shop", "Manage", "Support"].map((title) => (
            <div key={title}>
              <h3 className="font-semibold text-slate-950">{title}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-500">
                <span>Products</span><span>Orders</span><span>Returns</span><span>Reports</span>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};

export const ProtectedRoute = ({ roles, children }: { roles: string[]; children: React.ReactNode }) => {
  const { user } = useApp();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Package className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold">Login required</h1>
        <p className="mt-2 text-slate-500">Sign in with a demo account to access this area.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-md bg-primary-600 px-4 py-2 font-semibold text-white">Go to login</Link>
      </div>
    );
  }
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <Package className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-4 text-2xl font-bold">Access restricted</h1>
        <p className="mt-2 text-slate-500">Your current role does not have access to this dashboard.</p>
      </div>
    );
  }
  return <>{children}</>;
};
