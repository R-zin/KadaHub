import { BarChart3, Boxes, CircleDollarSign, FileBarChart, PackageSearch, Receipt, RotateCcw, Shield, ShoppingCart, Store, Truck, UserCheck, Users } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardCard, DataTable, Badge, Button, ErrorState, Modal } from "../components/ui";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { useApp } from "../context/AppContext";
import { adminService, type AdminStats, type AdminUser, type Transaction } from "../services/adminService";
import { returnService } from "../services/returnService";
import { formatCurrency, compactDate } from "../utils/format";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: Shield },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Products", to: "/admin/products", icon: PackageSearch },
  { label: "Inventory", to: "/admin/inventory", icon: Boxes },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Returns", to: "/admin/returns", icon: RotateCcw },
  { label: "Transactions", to: "/admin/transactions", icon: Receipt },
  { label: "Reports", to: "/admin/reports", icon: FileBarChart }
];

export const AdminPage = () => (
  <DashboardLayout title="Admin Dashboard" navItems={navItems}>
    <Routes>
      <Route index element={<AdminOverview />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="products" element={<ProductsPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="orders" element={<OrdersAdminPage />} />
      <Route path="returns" element={<ReturnsAdminPage />} />
      <Route path="transactions" element={<TransactionsPage />} />
      <Route path="reports" element={<ReportsPage />} />
    </Routes>
  </DashboardLayout>
);

const AdminOverview = () => {
  const { products, orders } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<{ label: string; value: number }[]>([]);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, d] = await Promise.all([
        adminService.stats(),
        adminService.categoryDistribution()
      ]);
      setStats(s);
      setDistribution(d);
    } catch {
      setError("Unable to load dashboard statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black">System Monitoring</h2>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-800">{error}</p>
          <div className="mt-4">
            <Button onClick={loadDashboardData}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-black">System Monitoring</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Revenue" value={loading ? "..." : formatCurrency(stats?.totalRevenue ?? 0)} icon={CircleDollarSign} />
        <DashboardCard title="Total Orders" value={loading ? "..." : stats?.totalOrders ?? 0} icon={ShoppingCart} />
        <DashboardCard title="Active Users" value={loading ? "..." : `${stats?.activeUsers ?? 0}${stats?.totalUsers ? ` / ${stats.totalUsers}` : ''}`} icon={Users} />
        <DashboardCard title="Customers" value={loading ? "..." : stats?.customers ?? 0} icon={UserCheck} />
        <DashboardCard title="Sellers" value={loading ? "..." : stats?.sellers ?? 0} icon={Store} />
        <DashboardCard title="Delivery Agents" value={loading ? "..." : stats?.deliveryAgents ?? 0} icon={Truck} />
        <DashboardCard title="Products" value={loading ? "..." : stats?.products ?? products.length} icon={PackageSearch} />
        <DashboardCard title="Pending Returns" value={loading ? "..." : stats?.pendingReturns ?? 0} icon={RotateCcw} />
        <DashboardCard title="Total Returns" value={loading ? "..." : stats?.totalReturns ?? 0} icon={RotateCcw} />
        <DashboardCard title="Refunds Paid" value={loading ? "..." : `${stats?.refunds ?? 0} (${formatCurrency(stats?.refundedAmount ?? 0)})`} icon={Receipt} />
        <DashboardCard title="Low Stock Items" value={loading ? "..." : stats?.lowStock ?? 0} icon={Boxes} />
        <DashboardCard title="Out of Stock" value={loading ? "..." : stats?.outOfStock ?? 0} icon={BarChart3} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold">Recent Orders</h3>
          <div className="mt-4 grid gap-2">
            {orders.slice(0, 6).map((order) => (
              <div key={order.id} className="flex justify-between rounded-md bg-slate-50 p-3 text-sm">
                <span className="font-semibold">#{order.orderNumber}</span>
                <span>{order.status}</span>
                <span className="font-semibold">{formatCurrency(order.total)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold">Category Distribution</h3>
          <div className="mt-4 grid gap-3">
            {distribution.map((item) => <Bar key={item.label} label={item.label} value={item.value} />)}
          </div>
        </section>
      </div>
      <div className="mt-6"><OrdersAdminPage /></div>
    </div>
  );
};

const UsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await adminService.getUsers();
      setUsers(list);
    } catch {
      setError("Failed to load users list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (user: AdminUser) => {
    try {
      setTogglingId(user.id);
      setError(null);
      setFeedback(null);
      const newStatus = !user.isActive;
      await adminService.setUserActive(user.id, newStatus);
      setFeedback(`User "${user.name}" has been ${newStatus ? "activated" : "deactivated"} successfully.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Failed to update user status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleRoleChange = async (user: AdminUser, newRole: string) => {
    try {
      setError(null);
      setFeedback(null);
      await adminService.setUserRole(user.id, newRole);
      setFeedback(`Role for "${user.name}" updated to ${newRole}.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Failed to update user role");
    }
  };

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">User Management ({filtered.length})</h2>
          <p className="text-xs text-slate-500 mt-0.5">{activeCount} active of {users.length} registered users</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Roles</option>
            <option value="customer">Customer</option>
            <option value="seller">Seller</option>
            <option value="delivery">Delivery</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      {feedback && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="ml-2 font-bold text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && <ErrorState message={error} />}
      {loading ? (
        <div className="py-8 text-center text-slate-500 animate-pulse">Loading users...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
          No users found matching your criteria.
        </div>
      ) : (
        <DataTable
          headers={["Name", "Email", "Role", "Status", "Action"]}
          rows={filtered.map((user) => [
            user.name,
            user.email,
            <select
              key={`role-${user.id}`}
              value={user.role}
              onChange={(e) => handleRoleChange(user, e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold capitalize bg-white focus:border-primary-500 focus:outline-none"
            >
              <option value="customer">Customer</option>
              <option value="seller">Seller</option>
              <option value="delivery">Delivery</option>
              <option value="admin">Admin</option>
            </select>,
            user.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>,
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={togglingId === user.id}
              onClick={() => toggle(user)}
            >
              {togglingId === user.id ? "Updating..." : user.isActive ? "Deactivate" : "Activate"}
            </Button>
          ])}
        />
      )}
    </div>
  );
};

const ProductsPage = () => {
  const { products, categories } = useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchStock =
      stockFilter === "all" ||
      (stockFilter === "out" && p.stock === 0) ||
      (stockFilter === "low" && p.stock > 0 && p.stock <= 20) ||
      (stockFilter === "in" && p.stock > 20);
    return matchSearch && matchCategory && matchStock;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Catalog Products ({filtered.length} total)</h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search products, brands, sellers..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in">In Stock (&gt;20)</option>
            <option value="low">Low Stock (1-20)</option>
            <option value="out">Out of Stock (0)</option>
          </select>
        </div>
      </div>

      <DataTable
        headers={["Product", "Category", "Subcategory", "Seller", "Price", "Stock", "Try-On"]}
        rows={paginated.map((product) => [
          <div className="flex items-center gap-2">
            {product.images?.[0] && (
              <img src={product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
            )}
            <span className="font-semibold text-slate-900">{product.name}</span>
          </div>,
          product.category,
          product.subcategory || "—",
          product.sellerName || "—",
          formatCurrency(product.price),
          product.stock === 0 ? <Badge tone="danger">0 Out</Badge> : product.stock <= 20 ? <Badge tone="warning">{product.stock} Low</Badge> : <Badge tone="success">{product.stock}</Badge>,
          product.isVirtualTryOnSupported ? <Badge tone="primary">Enabled</Badge> : "No"
        ])}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-slate-600">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} products
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const InventoryPage = () => {
  const { products, updateProductStock, categories } = useApp();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingStock, setEditingStock] = useState<{ [id: string]: number }>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const itemsPerPage = 20;

  const filtered = products.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sellerName.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "out" && p.stock === 0) ||
      (statusFilter === "low" && p.stock > 0 && p.stock <= 20) ||
      (statusFilter === "healthy" && p.stock > 20);
    return matchSearch && matchCategory && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleStockSave = async (productId: string) => {
    const newStock = editingStock[productId];
    if (newStock === undefined || isNaN(newStock) || newStock < 0) return;
    try {
      setSavingId(productId);
      await updateProductStock(productId, Math.floor(newStock));
      setMessage(`Stock updated for product #${productId}`);
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage("Failed to update stock");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Admin Inventory Management</h2>
          <p className="text-xs text-slate-500">Live database inventory records across all catalog items</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search product, seller..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Stock Levels</option>
            <option value="out">Out of Stock (0)</option>
            <option value="low">Low Stock (1-20)</option>
            <option value="healthy">In Stock (&gt;20)</option>
          </select>
        </div>
      </div>

      {message && <div className="rounded-md bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">{message}</div>}

      <DataTable
        headers={["Product", "Category", "Seller", "Stock", "Status", "Action"]}
        rows={paginated.map((product) => [
          <div className="font-semibold text-slate-900">{product.name}</div>,
          product.category,
          product.sellerName || "—",
          <input
            type="number"
            min="0"
            step="1"
            className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold"
            defaultValue={product.stock}
            onChange={(e) => setEditingStock({ ...editingStock, [product.id]: Number(e.target.value) })}
          />,
          product.stock === 0 ? <Badge tone="danger">Out of Stock</Badge> : product.stock <= 20 ? <Badge tone="warning">Low Stock ({product.stock})</Badge> : <Badge tone="success">In Stock ({product.stock})</Badge>,
          <Button
            variant="secondary"
            className="min-h-8 px-3 py-1"
            disabled={savingId === product.id || editingStock[product.id] === undefined || editingStock[product.id] === product.stock}
            onClick={() => handleStockSave(product.id)}
          >
            {savingId === product.id ? "Saving..." : "Update"}
          </Button>
        ])}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-slate-600">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} inventory items
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const OrdersAdminPage = () => {
  const { orders } = useApp();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const itemsPerPage = 15;

  const filtered = orders.filter((o) => {
    const custName = (o.customerName || o.deliveryAddress?.name || "").toLowerCase();
    const custEmail = (o.customerEmail || "").toLowerCase();
    const orderNum = o.orderNumber.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q || orderNum.includes(q) || custName.includes(q) || custEmail.includes(q);
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    const matchPayment = paymentFilter === "all" || o.paymentStatus === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const paymentBadge = (status: string) => {
    switch (status) {
      case "Paid": return <Badge tone="success">Paid</Badge>;
      case "Pending": return <Badge tone="warning">Pending</Badge>;
      case "Refunded": return <Badge tone="neutral">Refunded</Badge>;
      case "Failed": return <Badge tone="danger">Failed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const deliveryBadge = (status: string) => {
    switch (status) {
      case "Delivered": return <Badge tone="success">Delivered</Badge>;
      case "Out for Delivery":
      case "Shipped":
      case "Dispatched": return <Badge tone="primary">{status}</Badge>;
      case "Processing":
      case "Payment Confirmed":
      case "Order Placed": return <Badge tone="warning">{status}</Badge>;
      case "Cancelled": return <Badge tone="danger">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Orders Management ({filtered.length})</h2>
          <p className="text-xs text-slate-500">Live order records across all customers, payments, and fulfillment stages</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search order #, customer, email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Delivery Statuses</option>
            <option value="Order Placed">Order Placed</option>
            <option value="Payment Confirmed">Payment Confirmed</option>
            <option value="Processing">Processing</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Shipped">Shipped</option>
            <option value="Out for Delivery">Out for Delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          >
            <option value="all">All Payment Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Refunded">Refunded</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
          No orders found matching your filters.
        </div>
      ) : (
        <DataTable
          headers={["Order", "Date", "Customer", "Items", "Payment", "Delivery", "Total", "Action"]}
          rows={paginated.map((order) => [
            <span className="font-semibold text-slate-900">#{order.orderNumber}</span>,
            compactDate(order.date),
            <div>
              <div className="font-semibold text-slate-800">{order.customerName || order.deliveryAddress?.name || "Customer"}</div>
              {order.customerEmail && <div className="text-xs text-slate-400">{order.customerEmail}</div>}
            </div>,
            `${order.items?.length ?? 0} item${(order.items?.length ?? 0) === 1 ? "" : "s"}`,
            paymentBadge(order.paymentStatus),
            deliveryBadge(order.status),
            <span className="font-semibold text-slate-900">{formatCurrency(order.total)}</span>,
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1 text-xs"
              onClick={() => setSelectedOrder(order)}
            >
              View Details
            </Button>
          ])}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm text-slate-600">
          <span>
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} orders
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              className="min-h-8 px-3 py-1"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {selectedOrder && (
        <Modal title={`Order #${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Customer Details</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedOrder.customerName || selectedOrder.deliveryAddress?.name}</p>
                {selectedOrder.customerEmail && <p className="text-slate-600">{selectedOrder.customerEmail}</p>}
                {selectedOrder.deliveryAddress?.phone && <p className="text-slate-600">Phone: {selectedOrder.deliveryAddress.phone}</p>}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Shipping Address</p>
                <p className="mt-1 text-slate-800">{selectedOrder.deliveryAddress?.line1}</p>
                <p className="text-slate-800">
                  {[selectedOrder.deliveryAddress?.city, selectedOrder.deliveryAddress?.region, selectedOrder.deliveryAddress?.postalCode].filter(Boolean).join(", ")}
                </p>
                <div className="mt-2 flex gap-2">
                  {deliveryBadge(selectedOrder.status)}
                  {paymentBadge(selectedOrder.paymentStatus)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900">Ordered Items</h4>
              <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
                {selectedOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      {item.product?.images?.[0] && (
                        <img src={item.product.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                      )}
                      <div>
                        <p className="font-semibold text-slate-900">{item.product?.name || "Product"}</p>
                        <p className="text-xs text-slate-500">Qty: {item.quantity} × {formatCurrency(item.product?.price || 0)}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency((item.product?.price || 0) * (item.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedOrder.subtotal ?? selectedOrder.total)}</span>
              </div>
              {selectedOrder.deliveryFee != null && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Delivery Fee</span>
                  <span>{formatCurrency(selectedOrder.deliveryFee)}</span>
                </div>
              )}
              {selectedOrder.discount != null && selectedOrder.discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(selectedOrder.discount)}</span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-950">
                <span>Total</span>
                <span>{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const ReturnsAdminPage = () => {
  const { returns, refreshReturns } = useApp();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (id: string, action: "approve" | "reject") => {
    try {
      setProcessingId(id);
      setError(null);
      if (action === "approve") {
        await returnService.approve(id);
      } else {
        await returnService.reject(id);
      }
      await refreshReturns();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || err.message || "Failed to process return request");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-black">Return Requests</h2>
      {error && <ErrorState message={error} />}
      <div className="mt-4">
        <DataTable
          headers={["Product", "Reason", "Order", "Customer", "Status", "Actions"]}
          rows={returns.map((ret) => [
            ret.productName || "Product",
            ret.reason,
            `#${ret.orderNumber || ret.orderId}`,
            ret.customerName || "Customer",
            <Badge tone={ret.status === "Refunded" ? "success" : ret.status === "Rejected" ? "danger" : "warning"}>{ret.status}</Badge>,
            ret.status === "Requested" ? (
              <div className="flex gap-2">
                <Button
                  className="min-h-8 px-3 py-1"
                  disabled={processingId === ret.id}
                  onClick={() => act(ret.id, "approve")}
                >
                  {processingId === ret.id ? "Processing..." : "Approve & Refund"}
                </Button>
                <Button
                  variant="danger"
                  className="min-h-8 px-3 py-1"
                  disabled={processingId === ret.id}
                  onClick={() => act(ret.id, "reject")}
                >
                  {processingId === ret.id ? "Processing..." : "Reject"}
                </Button>
              </div>
            ) : <span className="text-slate-400">Resolved</span>
          ])}
        />
      </div>
    </div>
  );
};

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await adminService.getTransactions();
      setTransactions(list);
    } catch {
      setError("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = transactions.filter((t) => typeFilter === "all" || t.type === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Payment & Refund Transactions</h2>
          <p className="text-xs text-slate-500">Charges and refunds with real-time settlement status</p>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="all">All Transactions</option>
          <option value="charge">Charges Only (Sales)</option>
          <option value="refund">Refunds Only</option>
        </select>
      </div>

      {error && <ErrorState message={error} />}

      {loading ? (
        <div className="py-8 text-center text-slate-500 animate-pulse">Loading transactions...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
          No transactions found for the selected filter.
        </div>
      ) : (
        <DataTable
          headers={["Date", "Reference", "Order", "Type", "Status", "Amount"]}
          rows={filtered.map((t) => [
            compactDate(t.date),
            <span key={t.reference} className="font-mono text-xs">{t.reference}</span>,
            <span key={t.orderNumber} className="font-semibold text-slate-900">#{t.orderNumber}</span>,
            <Badge key="type" tone={t.type === "refund" ? "warning" : "primary"}>
              {t.type === "refund" ? "REFUND" : "CHARGE"}
            </Badge>,
            <Badge key="status" tone={t.status === "Paid" ? "success" : "warning"}>{t.status}</Badge>,
            <span key="amt" className={`font-semibold ${t.type === "refund" ? "text-rose-600" : "text-emerald-700"}`}>
              {t.type === "refund" ? `-${formatCurrency(t.amount)}` : `+${formatCurrency(t.amount)}`}
            </span>
          ])}
        />
      )}
    </div>
  );
};

const ReportsPage = () => {
  const [reports, setReports] = useState<{
    salesByDay: { date?: string; day: string; orders: number; revenue: number }[];
    inventoryByCategory: { category: string; stock: number; products: number; outOfStock?: number; lowStock?: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<"7" | "30" | "90" | "custom">("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadReports = useCallback(async (params?: { startDate?: string; endDate?: string; days?: number }) => {
    try {
      setLoading(true);
      setError(null);
      const rep = await adminService.getReports(params);
      setReports(rep);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || "Unable to load reports. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rangePreset !== "custom") {
      loadReports({ days: Number(rangePreset) });
    }
  }, [rangePreset, loadReports]);

  const handleApplyCustom = () => {
    if (!startDate || !endDate) {
      setError("Please select both start date and end date.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError("Start date cannot be after end date.");
      return;
    }
    loadReports({ startDate, endDate });
  };

  const sales = reports?.salesByDay ?? [];
  const inventory = reports?.inventoryByCategory ?? [];
  const maxRevenue = Math.max(1, ...sales.map((s) => s.revenue));
  const totalRevenue = sales.reduce((acc, s) => acc + s.revenue, 0);
  const totalOrders = sales.reduce((acc, s) => acc + s.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const rangeLabel = rangePreset === "custom"
    ? `${startDate || "Start"} to ${endDate || "End"}`
    : `Last ${rangePreset} Days`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">Reports and Analytics</h2>
          <p className="text-xs text-slate-500">Authoritative database aggregations for sales performance and catalog inventory</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["7", "30", "90"] as const).map((p) => (
            <Button
              key={p}
              variant={rangePreset === p ? "primary" : "secondary"}
              className="min-h-8 px-3 py-1 text-xs"
              onClick={() => { setRangePreset(p); }}
            >
              {p} Days
            </Button>
          ))}
          <Button
            variant={rangePreset === "custom" ? "primary" : "secondary"}
            className="min-h-8 px-3 py-1 text-xs"
            onClick={() => { setRangePreset("custom"); }}
          >
            Custom Range
          </Button>
        </div>
      </div>

      {rangePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            From:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-normal"
            />
          </label>
          <label className="flex items-center gap-2 font-semibold text-slate-700">
            To:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-normal"
            />
          </label>
          <Button className="min-h-8 px-3 py-1 text-xs" onClick={handleApplyCustom}>
            Filter Range
          </Button>
        </div>
      )}

      {error && <ErrorState message={error} />}

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          title={`Net Revenue (${rangeLabel})`}
          value={loading ? "..." : formatCurrency(totalRevenue)}
          icon={CircleDollarSign}
        />
        <DashboardCard
          title={`Total Orders (${rangeLabel})`}
          value={loading ? "..." : totalOrders}
          icon={ShoppingCart}
        />
        <DashboardCard
          title="Average Order Value"
          value={loading ? "..." : formatCurrency(avgOrderValue)}
          icon={Receipt}
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-slate-500 animate-pulse">Loading analytics...</div>
      ) : sales.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
          No sales recorded during this period ({rangeLabel}).
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Chart
            title={`Net Revenue (${rangeLabel})`}
            bars={sales.map((s) => ({ label: s.day || s.date || "—", value: Math.round((s.revenue / maxRevenue) * 100) }))}
          />
          <Chart
            title={`Orders (${rangeLabel})`}
            bars={sales.map((s) => ({ label: s.day || s.date || "—", value: Math.min(s.orders * 15, 100) }))}
          />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-bold">Category Inventory Breakdown</h3>
        <DataTable
          headers={["Category", "Products", "Total Stock", "Low Stock Items", "Out of Stock Items"]}
          rows={inventory.map((row) => [
            <span className="font-semibold text-slate-900">{row.category}</span>,
            row.products,
            row.stock,
            row.lowStock ? <Badge tone="warning">{row.lowStock}</Badge> : "0",
            row.outOfStock ? <Badge tone="danger">{row.outOfStock}</Badge> : "0"
          ])}
        />
      </div>
    </div>
  );
};

const Chart = ({ title, bars }: { title: string; bars: { label: string; value: number }[] }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-bold">{title}</h3>
    <div className="mt-5 flex h-52 items-end gap-3">
      {(bars.length ? bars : [{ label: "—", value: 0 }]).map((bar, index) => (
        <div key={index} className="flex flex-1 flex-col items-center gap-2">
          <div className="w-full rounded-t-md bg-primary-600" style={{ height: `${Math.min(bar.value, 100)}%` }} />
          <span className="text-xs text-slate-500">{bar.label}</span>
        </div>
      ))}
    </div>
  </section>
);

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{value}</span></div>
    <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-primary-600" style={{ width: `${Math.min(value * 5, 100)}%` }} /></div>
  </div>
);
