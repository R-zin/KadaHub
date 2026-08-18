import { BarChart3, Boxes, DollarSign, FileText, PackagePlus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import { DashboardCard, DataTable, Button, Badge } from "../components/ui";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { categories } from "../data/categories";
import { useApp } from "../context/AppContext";
import { sellerService } from "../services/sellerService";
import { formatCurrency } from "../utils/format";
import type { Product } from "../types";

const navItems = [
  { label: "Dashboard", to: "/seller", icon: Store },
  { label: "Products", to: "/seller/products", icon: ShoppingBag },
  { label: "Add Product", to: "/seller/products/new", icon: PackagePlus },
  { label: "Inventory", to: "/seller/inventory", icon: Boxes },
  { label: "Orders", to: "/seller/orders", icon: FileText },
  { label: "Reports", to: "/seller/reports", icon: BarChart3 }
];

export const SellerPage = () => (
  <DashboardLayout title="Seller Dashboard" navItems={navItems}>
    <Routes>
      <Route index element={<SellerOverview />} />
      <Route path="products" element={<SellerProducts />} />
      <Route path="products/new" element={<AddProduct />} />
      <Route path="inventory" element={<Inventory />} />
      <Route path="orders" element={<SellerOrders />} />
      <Route path="reports" element={<SellerReports />} />
    </Routes>
  </DashboardLayout>
);

const SellerOverview = () => {
  const { products, orders } = useApp();
  const stats = sellerService.stats(products, orders);
  return (
    <div>
      <h2 className="text-2xl font-black">Dashboard</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Total Sales" value={stats.totalSales} icon={ShoppingBag} />
        <DashboardCard title="Orders" value={stats.orders} icon={FileText} />
        <DashboardCard title="Products" value={stats.products} icon={Store} />
        <DashboardCard title="Low Stock" value={stats.lowStock} icon={Boxes} />
        <DashboardCard title="Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} />
      </div>
    </div>
  );
};

const sellerProductRows = (products: Product[], updateProductStock: (id: string, stock: number) => void, deleteProduct: (id: string) => void) =>
  products.slice(0, 18).map((product) => [
    <span className="font-semibold">{product.name}</span>,
    product.category,
    product.subcategory,
    formatCurrency(product.price),
    <input aria-label={`Stock for ${product.name}`} type="number" className="w-20 rounded-md border border-slate-200 px-2 py-1" value={product.stock} onChange={(event) => updateProductStock(product.id, Number(event.target.value))} />,
    product.isVirtualTryOnSupported ? <Badge tone="primary">Try-On</Badge> : <span className="text-slate-400">No</span>,
    <Button variant="danger" className="min-h-8 px-3 py-1" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
  ]);

const SellerProducts = () => {
  const { products, updateProductStock, deleteProduct } = useApp();
  return (
    <div>
      <h2 className="text-2xl font-black">Products</h2>
      <p className="mt-2 text-slate-500">Add, edit, delete, and update stock for products across categories.</p>
      <div className="mt-5"><DataTable headers={["Product", "Category", "Subcategory", "Price", "Stock", "Try-On", "Delete"]} rows={sellerProductRows(products, updateProductStock, deleteProduct)} /></div>
    </div>
  );
};

const AddProduct = () => {
  const { addProduct } = useApp();
  const [category, setCategory] = useState("Electronics");
  const active = categories.find((item) => item.name === category) ?? categories[0];
  const [form, setForm] = useState({
    name: "New Marketplace Product",
    price: 49,
    stock: 25,
    subcategory: active.subcategories[0],
    brand: "DemoBrand",
    tryOn: false
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    addProduct({
      name: form.name,
      description: "Seller-created mock product ready for backend integration.",
      price: Number(form.price),
      originalPrice: Number(form.price) + 10,
      discount: 10,
      category,
      subcategory: form.subcategory,
      brand: form.brand,
      images: [active.image],
      stock: Number(form.stock),
      sellerId: "s4",
      sellerName: "UrbanWear",
      specifications: { Source: "Seller dashboard", Status: "Mock product" },
      tags: [category.toLowerCase()],
      isFeatured: false,
      isNew: true,
      isBestSeller: false,
      isVirtualTryOnSupported: category === "Clothing" && form.tryOn,
      productType: form.subcategory.toLowerCase()
    });
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black">Add Product</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
        <Input label="Brand" value={form.brand} onChange={(value) => setForm({ ...form, brand: value })} />
        <label className="block text-sm font-medium">Category<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={category} onChange={(event) => { const next = categories.find((item) => item.name === event.target.value) ?? categories[0]; setCategory(next.name); setForm({ ...form, subcategory: next.subcategories[0], tryOn: false }); }}>{categories.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-medium">Subcategory<select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={form.subcategory} onChange={(event) => setForm({ ...form, subcategory: event.target.value })}>{active.subcategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <Input label="Price" type="number" value={String(form.price)} onChange={(value) => setForm({ ...form, price: Number(value) })} />
        <Input label="Stock" type="number" value={String(form.stock)} onChange={(value) => setForm({ ...form, stock: Number(value) })} />
      </div>
      {category === "Clothing" && (
        <label className="mt-5 flex items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm font-semibold text-primary-800">
          <input type="checkbox" checked={form.tryOn} onChange={(event) => setForm({ ...form, tryOn: event.target.checked })} />
          Enable Virtual Try-On for this supported clothing product
        </label>
      )}
      <Button className="mt-5">Create Product</Button>
    </form>
  );
};

const Inventory = () => {
  const { products, updateProductStock } = useApp();
  return (
    <div>
      <h2 className="text-2xl font-black">Inventory</h2>
      <div className="mt-5"><DataTable headers={["Product", "Category", "Stock", "Status"]} rows={products.slice(0, 20).map((product) => [
        product.name,
        product.category,
        <input type="number" className="w-24 rounded-md border border-slate-200 px-2 py-1" value={product.stock} onChange={(event) => updateProductStock(product.id, Number(event.target.value))} />,
        product.stock === 0 ? <Badge tone="danger">Out</Badge> : product.stock <= 20 ? <Badge tone="warning">Low</Badge> : <Badge tone="success">Healthy</Badge>
      ])} /></div>
    </div>
  );
};

const SellerOrders = () => {
  const { orders } = useApp();
  return <DataTable headers={["Order", "Items", "Payment", "Status", "Total"]} rows={orders.map((order) => [order.orderNumber, order.items.length, order.paymentStatus, order.status, formatCurrency(order.total)])} />;
};

const SellerReports = () => {
  const { products } = useApp();
  const grouped = categories.map((category) => ({ category: category.name, value: products.filter((product) => product.category === category.name).length }));
  return <div><h2 className="text-2xl font-black">Reports</h2><div className="mt-5 grid gap-3">{grouped.map((item) => <div key={item.category} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex justify-between text-sm font-semibold"><span>{item.category}</span><span>{item.value}</span></div><div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-primary-600" style={{ width: `${Math.min(item.value * 6, 100)}%` }} /></div></div>)}</div></div>;
};

const Input = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
  <label className="block text-sm font-medium">{label}<input type={type} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} /></label>
);
