import { BarChart3, Boxes, CircleDollarSign, FileBarChart, PackageSearch, Receipt, RotateCcw, Shield, ShoppingCart, Store, Users } from "lucide-react";
import { Route, Routes } from "react-router-dom";
import { DashboardCard, DataTable, Badge } from "../components/ui";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { useApp } from "../context/AppContext";
import { adminService } from "../services/adminService";
import { demoAccounts } from "../services/authService";
import { formatCurrency } from "../utils/format";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: Shield },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Products", to: "/admin/products", icon: PackageSearch },
  { label: "Inventory", to: "/admin/inventory", icon: Boxes },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
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
      <Route path="transactions" element={<TransactionsPage />} />
      <Route path="reports" element={<ReportsPage />} />
    </Routes>
  </DashboardLayout>
);

const AdminOverview = () => {
  const { products, orders, returns } = useApp();
  const stats = adminService.stats(products, orders, demoAccounts, returns);
  const distribution = adminService.categoryDistribution(products);
  return (
    <div>
      <h2 className="text-2xl font-black">System Monitoring</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={CircleDollarSign} />
        <DashboardCard title="Total Orders" value={stats.totalOrders} icon={ShoppingCart} />
        <DashboardCard title="Active Users" value={stats.activeUsers} icon={Users} />
        <DashboardCard title="Sellers" value={stats.sellers} icon={Store} />
        <DashboardCard title="Products" value={stats.products} icon={PackageSearch} />
        <DashboardCard title="Pending Returns" value={stats.pendingReturns} icon={RotateCcw} />
        <DashboardCard title="Low Stock Items" value={stats.lowStock} icon={Boxes} />
        <DashboardCard title="Reports" value="Ready" icon={BarChart3} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart title="Sales Overview" values={[72, 48, 84, 61, 96, 88]} />
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

const UsersPage = () => <DataTable headers={["Name", "Email", "Role", "Status"]} rows={demoAccounts.map((user) => [user.name, user.email, user.role, <Badge tone="success">Active</Badge>])} />;

const ProductsPage = () => {
  const { products } = useApp();
  return <DataTable headers={["Product", "Category", "Seller", "Price", "Try-On"]} rows={products.slice(0, 22).map((product) => [product.name, product.category, product.sellerName, formatCurrency(product.price), product.isVirtualTryOnSupported ? <Badge tone="primary">Enabled</Badge> : "No"])} />;
};

const InventoryPage = () => {
  const { products } = useApp();
  return <DataTable headers={["Product", "Stock", "Status"]} rows={products.slice(0, 25).map((product) => [product.name, product.stock, product.stock <= 20 ? <Badge tone="warning">Low Stock</Badge> : <Badge tone="success">Healthy</Badge>])} />;
};

const OrdersAdminPage = () => {
  const { orders } = useApp();
  return <DataTable headers={["Order", "Payment", "Delivery", "Items", "Total"]} rows={orders.map((order) => [order.orderNumber, order.paymentStatus, order.status, order.items.length, formatCurrency(order.total)])} />;
};

const TransactionsPage = () => {
  const { orders } = useApp();
  return <DataTable headers={["Transaction", "Order", "Status", "Amount"]} rows={orders.map((order) => [`TX-${order.orderNumber}`, order.orderNumber, <Badge tone="success">{order.paymentStatus}</Badge>, formatCurrency(order.total)])} />;
};

const ReportsPage = () => {
  const { products } = useApp();
  return <div><h2 className="text-2xl font-black">Reports and Analytics</h2><div className="mt-5 grid gap-4 lg:grid-cols-2"><Chart title="Revenue" values={[35, 58, 45, 77, 68, 91]} /><Chart title="Orders" values={[62, 42, 71, 53, 86, 74]} /></div><div className="mt-6"><ProductsPage /></div></div>;
};

const Chart = ({ title, values }: { title: string; values: number[] }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-bold">{title}</h3>
    <div className="mt-5 flex h-52 items-end gap-3">
      {values.map((value, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-primary-600" style={{ height: `${value}%` }} /><span className="text-xs text-slate-500">W{index + 1}</span></div>)}
    </div>
  </section>
);

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex justify-between text-sm font-semibold"><span>{label}</span><span>{value}</span></div>
    <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-primary-600" style={{ width: `${Math.min(value * 5, 100)}%` }} /></div>
  </div>
);
