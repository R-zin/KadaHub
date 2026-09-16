import { BarChart3, Boxes, CircleDollarSign, FileBarChart, PackageSearch, Receipt, RotateCcw, Shield, ShoppingCart, Store, Users } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardCard, DataTable, Badge, Button, ErrorState } from "../components/ui";
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
        <DashboardCard title="Sellers" value={loading ? "..." : stats?.sellers ?? 0} icon={Store} />
        <DashboardCard title="Products" value={loading ? "..." : stats?.products ?? products.length} icon={PackageSearch} />
        <DashboardCard title="Pending Returns" value={loading ? "..." : stats?.pendingReturns ?? 0} icon={RotateCcw} />
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
            <span className="capitalize font-medium">{user.role}</span>,
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
  return <DataTable headers={["Order", "Payment", "Delivery", "Items", "Total"]} rows={orders.map((order) => [order.orderNumber, order.paymentStatus, order.status, order.items.length, formatCurrency(order.total)])} />;
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
    salesByDay: { day: string; orders: number; revenue: number }[];
    inventoryByCategory: { category: string; stock: number; products: number; outOfStock?: number; lowStock?: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setError(null);
      const rep = await adminService.getReports();
      setReports(rep);
    } catch {
      setError("Unable to load reports. Please try again.");
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-black">Reports and Analytics</h2>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-800">{error}</p>
          <div className="mt-4"><Button onClick={loadReports}>Retry</Button></div>
        </div>
      </div>
    );
  }

  const sales = reports?.salesByDay ?? [];
  const inventory = reports?.inventoryByCategory ?? [];
  const maxRevenue = Math.max(1, ...sales.map((s) => s.revenue));
  const total7DayRevenue = sales.reduce((acc, s) => acc + s.revenue, 0);
  const total7DayOrders = sales.reduce((acc, s) => acc + s.orders, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">Reports and Analytics</h2>
        <div className="flex gap-4 text-sm font-semibold">
          <span>7-Day Net Revenue: <strong className="text-emerald-700">{formatCurrency(total7DayRevenue)}</strong></span>
          <span>7-Day Total Orders: <strong className="text-primary-700">{total7DayOrders}</strong></span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Net Revenue (last 7 days)" bars={sales.map((s) => ({ label: s.day, value: Math.round((s.revenue / maxRevenue) * 100) }))} />
        <Chart title="Orders (last 7 days)" bars={sales.map((s) => ({ label: s.day, value: s.orders * 10 }))} />
      </div>

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
