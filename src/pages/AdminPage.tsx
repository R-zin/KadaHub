import { BarChart3, Boxes, CircleDollarSign, FileBarChart, PackageSearch, Receipt, RotateCcw, Shield, ShoppingCart, Store, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardCard, DataTable, Badge, Button } from "../components/ui";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { useApp } from "../context/AppContext";
import { adminService, type AdminStats, type AdminUser, type Transaction } from "../services/adminService";
import { returnService } from "../services/returnService";
import { formatCurrency } from "../utils/format";

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
  const [distribution, setDistribution] = useState<{ label: string; value: number }[]>([]);
  useEffect(() => {
    adminService.stats().then(setStats).catch(() => setStats(null));
    adminService.categoryDistribution().then(setDistribution).catch(() => setDistribution([]));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-black">System Monitoring</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={CircleDollarSign} />
        <DashboardCard title="Total Orders" value={stats?.totalOrders ?? 0} icon={ShoppingCart} />
        <DashboardCard title="Active Users" value={stats?.activeUsers ?? 0} icon={Users} />
        <DashboardCard title="Sellers" value={stats?.sellers ?? 0} icon={Store} />
        <DashboardCard title="Products" value={stats?.products ?? products.length} icon={PackageSearch} />
        <DashboardCard title="Pending Returns" value={stats?.pendingReturns ?? 0} icon={RotateCcw} />
        <DashboardCard title="Low Stock Items" value={stats?.lowStock ?? 0} icon={Boxes} />
        <DashboardCard title="Reports" value="Ready" icon={BarChart3} />
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
  const load = () => adminService.getUsers().then(setUsers).catch(() => setUsers([]));
  useEffect(() => { load(); }, []);
  const toggle = async (user: AdminUser) => { await adminService.setUserActive(user.id, !user.isActive); load(); };
  return (
    <DataTable
      headers={["Name", "Email", "Role", "Status", "Action"]}
      rows={users.map((user) => [
        user.name,
        user.email,
        user.role,
        user.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>,
        <Button variant="secondary" className="min-h-8 px-3 py-1" onClick={() => toggle(user)}>{user.isActive ? "Deactivate" : "Activate"}</Button>
      ])}
    />
  );
};

const ProductsPage = () => {
  const { products } = useApp();
  return <DataTable headers={["Product", "Category", "Seller", "Price", "Try-On"]} rows={products.slice(0, 50).map((product) => [product.name, product.category, product.sellerName, formatCurrency(product.price), product.isVirtualTryOnSupported ? <Badge tone="primary">Enabled</Badge> : "No"])} />;
};

const InventoryPage = () => {
  const { products, updateProductStock } = useApp();
  return (
    <DataTable
      headers={["Product", "Stock", "Status"]}
      rows={products.slice(0, 50).map((product) => [
        product.name,
        <input type="number" className="w-24 rounded-md border border-slate-200 px-2 py-1" defaultValue={product.stock} onBlur={(e) => updateProductStock(product.id, Number(e.target.value))} />,
        product.stock === 0 ? <Badge tone="danger">Out</Badge> : product.stock <= 20 ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">Healthy</Badge>
      ])}
    />
  );
};

const OrdersAdminPage = () => {
  const { orders } = useApp();
  return <DataTable headers={["Order", "Payment", "Delivery", "Items", "Total"]} rows={orders.map((order) => [order.orderNumber, order.paymentStatus, order.status, order.items.length, formatCurrency(order.total)])} />;
};

const ReturnsAdminPage = () => {
  const { returns, refreshReturns } = useApp();
  const act = async (id: string, action: "approve" | "reject") => {
    if (action === "approve") await returnService.approve(id); else await returnService.reject(id);
    await refreshReturns();
  };
  return (
    <div>
      <h2 className="text-2xl font-black">Return Requests</h2>
      <div className="mt-5">
        <DataTable
          headers={["Reason", "Order", "Status", "Actions"]}
          rows={returns.map((ret) => [
            ret.reason,
            `#${ret.orderId}`,
            <Badge tone={ret.status === "Refunded" ? "success" : ret.status === "Rejected" ? "danger" : "warning"}>{ret.status}</Badge>,
            ret.status === "Requested" ? (
              <div className="flex gap-2">
                <Button className="min-h-8 px-3 py-1" onClick={() => act(ret.id, "approve")}>Approve & Refund</Button>
                <Button variant="danger" className="min-h-8 px-3 py-1" onClick={() => act(ret.id, "reject")}>Reject</Button>
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
  useEffect(() => { adminService.getTransactions().then(setTransactions).catch(() => setTransactions([])); }, []);
  return (
    <DataTable
      headers={["Reference", "Order", "Type", "Status", "Amount"]}
      rows={transactions.map((t) => [t.reference, t.orderNumber, t.type, <Badge tone={t.status === "Paid" ? "success" : "warning"}>{t.status}</Badge>, formatCurrency(t.amount)])}
    />
  );
};

const ReportsPage = () => {
  const [reports, setReports] = useState<{ salesByDay: { day: string; orders: number; revenue: number }[]; inventoryByCategory: { category: string; stock: number; products: number }[] } | null>(null);
  useEffect(() => { adminService.getReports().then(setReports).catch(() => setReports(null)); }, []);
  const sales = reports?.salesByDay ?? [];
  const maxRevenue = Math.max(1, ...sales.map((s) => s.revenue));
  return (
    <div>
      <h2 className="text-2xl font-black">Reports and Analytics</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Chart title="Revenue (last 7 days)" bars={sales.map((s) => ({ label: s.day, value: Math.round((s.revenue / maxRevenue) * 100) }))} />
        <Chart title="Orders (last 7 days)" bars={sales.map((s) => ({ label: s.day, value: s.orders * 10 }))} />
      </div>
      <div className="mt-6"><ProductsPage /></div>
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
