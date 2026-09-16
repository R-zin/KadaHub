import {
  AlertCircle,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  DollarSign,
  Edit,
  Eye,
  FileText,
  Image as ImageIcon,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Upload,
  X
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { Badge, Button, DashboardCard, DataTable, Modal } from "../components/ui";
import { COMMON_SPEC_KEYS, getSuggestedProductTypes } from "../constants";
import { useApp } from "../context/AppContext";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { productService } from "../services/productService";
import type { Order, Product } from "../types";
import { formatCurrency } from "../utils/format";

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

// ---------------------------------------------------------------------------
// Helper Hook: Backend-scoped Seller Products
// ---------------------------------------------------------------------------
const useSellerProducts = () => {
  const { user, products } = useApp();
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.role === "seller") {
        // Backend filtering via GET /api/products?sellerId=:id
        const list = await productService.getProducts({ sellerId: user.id });
        setSellerProducts(list);
      } else {
        setSellerProducts(products);
      }
    } catch {
      setSellerProducts(products.filter((p) => !user || user.role !== "seller" || p.sellerId === user.id));
    } finally {
      setLoading(false);
    }
  }, [user, products]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { sellerProducts, loading, refetch: fetchProducts };
};

// ---------------------------------------------------------------------------
// 1. Seller Overview
// ---------------------------------------------------------------------------
const SellerOverview = () => {
  const { user, orders } = useApp();
  const { sellerProducts: myProducts } = useSellerProducts();

  const stats = useMemo(() => {
    const lowStock = myProducts.filter((p) => p.stock > 0 && p.stock <= 20).length;
    const outOfStock = myProducts.filter((p) => p.stock === 0).length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

    return {
      totalSales: orders.length,
      orders: orders.length,
      products: myProducts.length,
      lowStock,
      outOfStock,
      revenue: totalRevenue
    };
  }, [myProducts, orders]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Dashboard Overview</h2>
        <p className="text-sm text-slate-500">
          Welcome back{user?.name ? `, ${user.name}` : ""}! Here is a summary of your store performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard title="Total Sales" value={stats.totalSales} icon={ShoppingBag} />
        <DashboardCard title="Orders" value={stats.orders} icon={FileText} />
        <DashboardCard title="My Products" value={stats.products} icon={Store} />
        <DashboardCard
          title="Low / Out of Stock"
          value={`${stats.lowStock} / ${stats.outOfStock}`}
          icon={Boxes}
          detail={stats.outOfStock > 0 ? `${stats.outOfStock} out of stock` : "Stock healthy"}
        />
        <DashboardCard title="Store Revenue" value={formatCurrency(stats.revenue)} icon={DollarSign} />
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-900">Quick Inventory Management</h3>
          <p className="text-xs text-slate-500">Easily update catalog items or check incoming customer orders.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/seller/products/new">
            <Button className="min-h-9 px-3 text-xs">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </Link>
          <Link to="/seller/inventory">
            <Button variant="secondary" className="min-h-9 px-3 text-xs">
              Manage Stock
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Recent Customer Orders</h3>
          <Link to="/seller/orders" className="text-xs font-semibold text-primary-600 hover:underline">
            View All Orders
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No orders received yet.</p>
        ) : (
          <DataTable
            headers={["Order", "Date", "Customer", "Items", "Total", "Status"]}
            rows={orders.slice(0, 5).map((order) => [
              <span key="num" className="font-mono font-semibold text-slate-900">{order.orderNumber}</span>,
              new Date(order.date).toLocaleDateString(),
              order.deliveryAddress?.name || "Customer",
              order.items.length,
              formatCurrency(order.total),
              <Badge key="st" tone={order.status === "Delivered" ? "success" : "primary"}>
                {order.status}
              </Badge>
            ])}
          />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. Seller Products List & Management
// ---------------------------------------------------------------------------
const SellerProducts = () => {
  const { updateProductStock, deleteProduct } = useApp();
  const { sellerProducts, loading, refetch } = useSellerProducts();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categoriesList = useMemo(() => {
    const set = new Set(sellerProducts.map((p) => p.category));
    return ["All", ...Array.from(set)];
  }, [sellerProducts]);

  const filtered = useMemo(() => {
    return sellerProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.subcategory.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "All" || p.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [sellerProducts, search, categoryFilter]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      setDeletingId(id);
      try {
        await deleteProduct(id);
        await refetch();
      } catch (err: any) {
        alert(err?.message || "Failed to delete product.");
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleStockChange = async (product: Product, value: number) => {
    const clean = Math.max(0, Math.floor(value || 0));
    await updateProductStock(product.id, clean);
    await refetch();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Products</h2>
          <p className="text-sm text-slate-500">
            Manage your store's listings, update stock levels, or modify product specifications.
          </p>
        </div>
        <Link to="/seller/products/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add New Product
          </Button>
        </Link>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name, brand, or subcategory..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 animate-pulse">Loading products...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Store className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-700">No products match your criteria.</p>
          <p className="mt-1 text-xs text-slate-400">
            Try adjusting your search filters or click "Add New Product" to list a product.
          </p>
        </div>
      ) : (
        <DataTable
          headers={["Product", "Category / Sub", "Price", "Stock", "Try-On", "Actions"]}
          rows={filtered.map((product) => [
            <div key="prod" className="flex items-center gap-3">
              <img
                src={product.images[0] || "/placeholder.png"}
                alt={product.name}
                className="h-10 w-10 rounded-md border border-slate-100 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80";
                }}
              />
              <div>
                <div className="font-semibold text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-400">{product.brand}</div>
              </div>
            </div>,
            <div key="cat">
              <div className="font-medium text-slate-800">{product.category}</div>
              <div className="text-xs text-slate-400">{product.subcategory}</div>
            </div>,
            <div key="price">
              <div className="font-semibold text-slate-900">{formatCurrency(product.price)}</div>
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="text-xs text-slate-400 line-through">
                  {formatCurrency(product.originalPrice)}
                </div>
              )}
            </div>,
            <div key="stock" className="flex items-center gap-2">
              <input
                aria-label={`Stock for ${product.name}`}
                type="number"
                min="0"
                className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold focus:border-primary-500 focus:outline-none"
                defaultValue={product.stock}
                onBlur={(e) => handleStockChange(product, Number(e.target.value))}
              />
              {product.stock === 0 ? (
                <Badge tone="danger">Out</Badge>
              ) : product.stock <= 20 ? (
                <Badge tone="warning">Low</Badge>
              ) : (
                <Badge tone="success">OK</Badge>
              )}
            </div>,
            product.isVirtualTryOnSupported ? (
              <Badge key="try" tone="primary">
                Supported
              </Badge>
            ) : (
              <span key="try" className="text-xs text-slate-400">
                No
              </span>
            ),
            <div key="actions" className="flex items-center gap-1">
              <Button
                variant="secondary"
                className="min-h-8 px-2 py-1 text-xs"
                onClick={() => setEditingProduct(product)}
                title="Edit Product"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="danger"
                className="min-h-8 px-2 py-1 text-xs"
                disabled={deletingId === product.id}
                onClick={() => handleDelete(product.id, product.name)}
                title="Delete Product"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ])}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. Edit Product Modal
// ---------------------------------------------------------------------------
interface EditProductModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const EditProductModal = ({ product, onClose, onSuccess }: EditProductModalProps) => {
  const { updateProduct, categories } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory,
    productType: product.productType || product.subcategory,
    price: String(product.price),
    originalPrice: String(product.originalPrice || product.price),
    discount: String(product.discount || 0),
    stock: String(product.stock),
    isVirtualTryOnSupported: Boolean(product.isVirtualTryOnSupported)
  });

  const [specs, setSpecs] = useState<{ key: string; value: string }[]>(
    Object.entries(product.specifications || {}).map(([key, value]) => ({ key, value }))
  );
  const [tagsInput, setTagsInput] = useState((product.tags || []).join(", "));
  const [images, setImages] = useState<string[]>(product.images || []);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const activeCategory = useMemo(
    () => categories.find((c) => c.name === form.category) ?? categories[0],
    [categories, form.category]
  );

  const handleCategoryChange = (newCat: string) => {
    const cat = categories.find((c) => c.name === newCat) ?? categories[0];
    const firstSub = cat?.subcategories[0] || "";
    const suggestions = getSuggestedProductTypes(firstSub);
    setForm((prev) => ({
      ...prev,
      category: cat.name,
      subcategory: firstSub,
      productType: suggestions[0] || firstSub,
      isVirtualTryOnSupported: cat.name === "Clothing" ? prev.isVirtualTryOnSupported : false
    }));
  };

  const handleSubcategoryChange = (newSub: string) => {
    const suggestions = getSuggestedProductTypes(newSub);
    setForm((prev) => ({
      ...prev,
      subcategory: newSub,
      productType: suggestions[0] || newSub
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      const uploaded = await productService.uploadImages(files);
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || "Failed to upload image(s).");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addImageUrl = () => {
    if (urlInput.trim()) {
      setImages((prev) => [...prev, urlInput.trim()]);
      setUrlInput("");
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  const handlePriceChange = (val: string) => {
    setForm((prev) => {
      const num = Number(val);
      const orig = Number(prev.originalPrice);
      let disc = prev.discount;
      if (orig > 0 && num > 0 && orig >= num) {
        disc = String(Math.round(((orig - num) / orig) * 100));
      }
      return { ...prev, price: val, discount: disc };
    });
  };

  const handleOriginalPriceChange = (val: string) => {
    setForm((prev) => {
      const orig = Number(val);
      const num = Number(prev.price);
      let disc = prev.discount;
      if (orig > 0 && num > 0 && orig >= num) {
        disc = String(Math.round(((orig - num) / orig) * 100));
      }
      return { ...prev, originalPrice: val, discount: disc };
    });
  };

  const addSpecRow = (key = "", value = "") => {
    setSpecs((prev) => [...prev, { key, value }]);
  };

  const updateSpec = (index: number, field: "key" | "value", val: string) => {
    setSpecs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const removeSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (!form.name.trim()) return setError("Product name is required.");
    if (!form.brand.trim()) return setError("Brand name is required.");
    if (isNaN(priceNum) || priceNum < 0) return setError("Valid price >= 0 is required.");
    if (isNaN(stockNum) || stockNum < 0) return setError("Stock must be an integer >= 0.");
    if (images.length === 0) return setError("At least one product image is required.");

    const finalSpecs: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key.trim()) finalSpecs[s.key.trim()] = s.value.trim();
    });

    const finalTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      await updateProduct(product.id, {
        name: form.name.trim(),
        brand: form.brand.trim(),
        description: form.description.trim(),
        category: form.category,
        subcategory: form.subcategory,
        productType: form.productType.trim() || form.subcategory,
        price: priceNum,
        originalPrice: Number(form.originalPrice) || priceNum,
        discount: Number(form.discount) || 0,
        stock: Math.floor(stockNum),
        specifications: finalSpecs,
        tags: finalTags,
        images,
        isVirtualTryOnSupported: form.category === "Clothing" && form.isVirtualTryOnSupported
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Failed to update product.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Edit Product: ${product.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Input label="Brand *" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Description
          </label>
          <textarea
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-primary-500 focus:outline-none"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Category
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Subcategory
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={form.subcategory}
              onChange={(e) => handleSubcategoryChange(e.target.value)}
            >
              {activeCategory?.subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Product Type
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={form.productType}
              onChange={(e) => setForm({ ...form, productType: e.target.value })}
              list="edit-product-type-suggestions"
            />
            <datalist id="edit-product-type-suggestions">
              {getSuggestedProductTypes(form.subcategory).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Input
            label="Price (₹) *"
            type="number"
            min="0"
            step="any"
            value={form.price}
            onChange={handlePriceChange}
          />
          <Input
            label="Original Price (₹)"
            type="number"
            min="0"
            step="any"
            value={form.originalPrice}
            onChange={handleOriginalPriceChange}
          />
          <Input
            label="Discount (%)"
            type="number"
            min="0"
            max="100"
            value={form.discount}
            onChange={(v) => setForm({ ...form, discount: v })}
          />
          <Input
            label="Stock Quantity *"
            type="number"
            min="0"
            value={form.stock}
            onChange={(v) => setForm({ ...form, stock: v })}
          />
        </div>

        {form.category === "Clothing" && (
          <label className="flex items-center gap-3 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm font-semibold text-primary-900">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-primary-300 text-primary-600"
              checked={form.isVirtualTryOnSupported}
              onChange={(e) => setForm({ ...form, isVirtualTryOnSupported: e.target.checked })}
            />
            Enable Virtual Try-On for this clothing product
          </label>
        )}

        {/* Multi-Image Management */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Product Images ({images.length})
            </label>
            <span className="text-xs text-slate-400">First image will be used as primary</span>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={idx}
                className="group relative h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                <img src={img} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover" />
                {idx === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    Primary
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition group-hover:opacity-100">
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-800 hover:bg-white"
                    >
                      Make Main
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="rounded-full bg-rose-600 p-1 text-white hover:bg-rose-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Upload More Images"}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>
            <div className="flex flex-1 items-center gap-1">
              <input
                type="url"
                placeholder="Or paste an image URL..."
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <Button type="button" variant="secondary" className="min-h-8 px-2.5 text-xs" onClick={addImageUrl}>
                Add URL
              </Button>
            </div>
          </div>
        </div>

        {/* Specifications */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Specifications
            </label>
            <Button
              type="button"
              variant="secondary"
              className="min-h-7 px-2 text-xs"
              onClick={() => addSpecRow()}
            >
              <Plus className="h-3.5 w-3.5" /> Add Spec
            </Button>
          </div>
          <div className="space-y-2">
            {specs.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key (e.g., Material)"
                  className="w-1/3 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
                  value={s.key}
                  onChange={(e) => updateSpec(idx, "key", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Value (e.g., 100% Cotton)"
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
                  value={s.value}
                  onChange={(e) => updateSpec(idx, "value", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeSpec(idx)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <Input
          label="Tags (comma-separated)"
          value={tagsInput}
          onChange={(v) => setTagsInput(v)}
        />

        <div className="flex justify-end gap-2 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// 4. Add Product Page
// ---------------------------------------------------------------------------
const AddProduct = () => {
  const { addProduct, categories } = useApp();
  const navigate = useNavigate();

  const [category, setCategory] = useState("Clothing");
  const activeCategory = useMemo(
    () => categories.find((item) => item.name === category) ?? categories[0],
    [categories, category]
  );

  const [form, setForm] = useState({
    name: "",
    brand: "",
    description: "",
    subcategory: "T-Shirts",
    productType: "T-Shirt",
    price: "",
    originalPrice: "",
    discount: "",
    stock: "",
    tryOn: false
  });

  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([
    { key: "Material", value: "" },
    { key: "Colour", value: "" },
    { key: "Size", value: "" }
  ]);
  const [tagsInput, setTagsInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync initial subcategory when category changes
  const handleCategorySelect = (selectedCategory: string) => {
    setCategory(selectedCategory);
    const catObj = categories.find((c) => c.name === selectedCategory) ?? categories[0];
    const firstSub = catObj?.subcategories[0] || "";
    const suggestions = getSuggestedProductTypes(firstSub);
    setForm((prev) => ({
      ...prev,
      subcategory: firstSub,
      productType: suggestions[0] || firstSub,
      tryOn: selectedCategory === "Clothing" ? prev.tryOn : false
    }));
  };

  const handleSubcategorySelect = (selectedSubcategory: string) => {
    const suggestions = getSuggestedProductTypes(selectedSubcategory);
    setForm((prev) => ({
      ...prev,
      subcategory: selectedSubcategory,
      productType: suggestions[0] || selectedSubcategory
    }));
  };

  const handlePriceChange = (val: string) => {
    setForm((prev) => {
      const num = Number(val);
      const orig = Number(prev.originalPrice);
      let disc = prev.discount;
      if (orig > 0 && num > 0 && orig >= num) {
        disc = String(Math.round(((orig - num) / orig) * 100));
      }
      return { ...prev, price: val, discount: disc };
    });
  };

  const handleOriginalPriceChange = (val: string) => {
    setForm((prev) => {
      const orig = Number(val);
      const num = Number(prev.price);
      let disc = prev.discount;
      if (orig > 0 && num > 0 && orig >= num) {
        disc = String(Math.round(((orig - num) / orig) * 100));
      }
      return { ...prev, originalPrice: val, discount: disc };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    setError(null);
    try {
      const uploaded = await productService.uploadImages(files);
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || "Failed to upload image(s).");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addImageUrl = () => {
    if (urlInput.trim()) {
      setImages((prev) => [...prev, urlInput.trim()]);
      setUrlInput("");
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      return [target, ...rest];
    });
  };

  const addSpecRow = (key = "", value = "") => {
    setSpecs((prev) => [...prev, { key, value }]);
  };

  const updateSpec = (index: number, field: "key" | "value", val: string) => {
    setSpecs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const removeSpec = (index: number) => {
    setSpecs((prev) => prev.filter((_, i) => i !== index));
  };

  const addQuickSpec = (key: string) => {
    if (!specs.some((s) => s.key.toLowerCase() === key.toLowerCase())) {
      setSpecs((prev) => [...prev, { key, value: "" }]);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const priceNum = Number(form.price);
    const stockNum = Number(form.stock);

    if (!form.name.trim()) return setError("Product name is required.");
    if (!form.brand.trim()) return setError("Brand name is required.");
    if (isNaN(priceNum) || priceNum < 0) return setError("Valid price >= 0 is required.");
    if (isNaN(stockNum) || stockNum < 0) return setError("Stock must be an integer >= 0.");
    if (images.length === 0) {
      return setError("Please upload or add at least one product image.");
    }

    const finalSpecs: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key.trim()) finalSpecs[s.key.trim()] = s.value.trim();
    });

    const finalTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      await addProduct({
        name: form.name.trim(),
        description: form.description.trim() || `${form.brand} ${form.name}`,
        price: priceNum,
        originalPrice: Number(form.originalPrice) || priceNum,
        discount: Number(form.discount) || 0,
        category,
        subcategory: form.subcategory,
        brand: form.brand.trim(),
        images,
        stock: Math.floor(stockNum),
        specifications: finalSpecs,
        tags: finalTags.length > 0 ? finalTags : [category.toLowerCase(), form.subcategory.toLowerCase()],
        isFeatured: false,
        isNew: true,
        isBestSeller: false,
        isVirtualTryOnSupported: category === "Clothing" && form.tryOn,
        productType: form.productType.trim() || form.subcategory
      });

      setSuccess("Product successfully listed in KadaHub catalog!");
      setTimeout(() => {
        navigate("/seller/products");
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Failed to create product. Please review inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Add New Product</h2>
          <p className="text-sm text-slate-500">
            Publish an item to the marketplace with images, specifications, and accurate stock.
          </p>
        </div>
        <Link to="/seller/products">
          <Button type="button" variant="secondary" className="min-h-9 px-3 text-xs">
            Cancel
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Info */}
      <div className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Product Name *"
            placeholder="e.g. Classic Black Cotton T-Shirt"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Input
            label="Brand Name *"
            placeholder="e.g. KadaWear"
            value={form.brand}
            onChange={(v) => setForm({ ...form, brand: v })}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Description
          </label>
          <textarea
            rows={3}
            placeholder="Detailed description of features, quality, and usage..."
            className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-primary-500 focus:outline-none"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {/* Dynamic Category -> Subcategory -> Product Type */}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Category *
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={category}
              onChange={(e) => handleCategorySelect(e.target.value)}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Subcategory *
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              value={form.subcategory}
              onChange={(e) => handleSubcategorySelect(e.target.value)}
            >
              {activeCategory?.subcategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Product Type *
            </label>
            <div className="mt-1 flex gap-1">
              <input
                type="text"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="e.g. T-Shirt"
                value={form.productType}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
                list="product-type-suggestions"
              />
              <datalist id="product-type-suggestions">
                {getSuggestedProductTypes(form.subcategory).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {getSuggestedProductTypes(form.subcategory).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setForm({ ...form, productType: st })}
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium transition ${
                    form.productType === st
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing and Stock */}
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            label="Selling Price (₹) *"
            type="number"
            min="0"
            step="any"
            placeholder="799"
            value={form.price}
            onChange={handlePriceChange}
          />
          <Input
            label="Original / MRP (₹)"
            type="number"
            min="0"
            step="any"
            placeholder="999"
            value={form.originalPrice}
            onChange={handleOriginalPriceChange}
          />
          <Input
            label="Discount (%)"
            type="number"
            min="0"
            max="100"
            placeholder="20"
            value={form.discount}
            onChange={(v) => setForm({ ...form, discount: v })}
          />
          <Input
            label="Stock Quantity *"
            type="number"
            min="0"
            placeholder="50"
            value={form.stock}
            onChange={(v) => setForm({ ...form, stock: v })}
          />
        </div>

        {/* Virtual Try-On Toggle (Only for Clothing) */}
        {category === "Clothing" && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-primary-200 bg-primary-50/70 p-4 text-sm font-semibold text-primary-950 transition hover:bg-primary-50">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
              checked={form.tryOn}
              onChange={(e) => setForm({ ...form, tryOn: e.target.checked })}
            />
            <div>
              <div className="font-bold text-primary-900">Enable Virtual Try-On</div>
              <div className="text-xs font-normal text-primary-700">
                Allows shoppers to try this garment on interactive 2D models using KadaHub Try-On Studio.
              </div>
            </div>
          </label>
        )}

        {/* Multi-Image Upload & Preview Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Product Images ({images.length})</h3>
              <p className="text-xs text-slate-500">
                Upload multiple product angles. The first image will be set as the main display.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-700">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading..." : "Upload Images"}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* URL Input option */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              placeholder="Or enter direct image URL (https://...)..."
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              className="min-h-8 px-3 text-xs"
              onClick={addImageUrl}
            >
              Add URL
            </Button>
          </div>

          {/* Image Previews */}
          {images.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className="group relative h-28 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <img
                    src={img}
                    alt={`Product preview ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80";
                    }}
                  />
                  {idx === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                      Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      className="absolute left-1.5 top-1.5 hidden rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur group-hover:block hover:bg-slate-950"
                    >
                      Set Primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-rose-600 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-rose-700"
                    title="Remove Image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-8 text-slate-400">
              <ImageIcon className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-medium text-slate-500">
                No images selected yet. Upload at least 1 image.
              </p>
            </div>
          )}
        </div>

        {/* Specifications Key-Value Builder */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Specifications</h3>
              <p className="text-xs text-slate-500">
                Add technical parameters, fabric, color, or dimensions as key/value pairs.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-8 px-3 text-xs"
              onClick={() => addSpecRow()}
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
          </div>

          {/* Quick-add chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Quick keys:</span>
            {COMMON_SPEC_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => addQuickSpec(k)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-700 transition hover:border-primary-400 hover:text-primary-700"
              >
                + {k}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2.5">
            {specs.map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Key (e.g., Material)"
                  className="w-1/3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-primary-500 focus:outline-none"
                  value={s.key}
                  onChange={(e) => updateSpec(idx, "key", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Value (e.g., 100% Combed Cotton)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none"
                  value={s.value}
                  onChange={(e) => updateSpec(idx, "value", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeSpec(idx)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
          <h3 className="text-sm font-bold text-slate-900">Product Tags</h3>
          <p className="text-xs text-slate-500">Comma-separated tags for search filtering.</p>
          <input
            type="text"
            placeholder="e.g. casual, cotton, black, t-shirt, summer"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          {tagsInput && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800"
                  >
                    #{tag}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
        <Link to="/seller/products">
          <Button type="button" variant="secondary" disabled={submitting}>
            Cancel
          </Button>
        </Link>
        <Button type="submit" disabled={submitting || uploading} className="min-w-36">
          {submitting ? "Publishing Product..." : "Create Product"}
        </Button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// 5. Inventory Management
// ---------------------------------------------------------------------------
const Inventory = () => {
  const { updateProductStock } = useApp();
  const { sellerProducts, loading, refetch } = useSellerProducts();
  const [filter, setFilter] = useState<"all" | "out" | "low" | "healthy">("all");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sellerProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === "out") return p.stock === 0;
      if (filter === "low") return p.stock > 0 && p.stock <= 20;
      if (filter === "healthy") return p.stock > 20;
      return true;
    });
  }, [sellerProducts, search, filter]);

  const handleStockUpdate = async (productId: string, newStock: number) => {
    const clean = Math.max(0, Math.floor(newStock || 0));
    setSavingId(productId);
    try {
      await updateProductStock(productId, clean);
      await refetch();
    } catch (err: any) {
      alert(err?.message || "Failed to update stock.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Inventory Management</h2>
        <p className="text-sm text-slate-500">
          Track stock levels across all your listings. Changes are saved immediately and prevent negative numbers.
        </p>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "all" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Items ({sellerProducts.length})
          </button>
          <button
            onClick={() => setFilter("out")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "out" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Out of Stock ({sellerProducts.filter((p) => p.stock === 0).length})
          </button>
          <button
            onClick={() => setFilter("low")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "low" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Low Stock ({sellerProducts.filter((p) => p.stock > 0 && p.stock <= 20).length})
          </button>
          <button
            onClick={() => setFilter("healthy")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === "healthy" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            In Stock ({sellerProducts.filter((p) => p.stock > 20).length})
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none sm:w-60"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 animate-pulse">Loading inventory...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No inventory items match the selected filter.
        </div>
      ) : (
        <DataTable
          headers={["Product", "Category", "Current Stock", "Status", "Quick Adjust"]}
          rows={filtered.map((product) => [
            <div key="prod" className="flex items-center gap-3">
              <img
                src={product.images[0] || "/placeholder.png"}
                alt={product.name}
                className="h-10 w-10 rounded-md border border-slate-100 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&auto=format&fit=crop&q=80";
                }}
              />
              <div>
                <div className="font-semibold text-slate-900">{product.name}</div>
                <div className="text-xs text-slate-400">{product.brand}</div>
              </div>
            </div>,
            product.category,
            <div key="stock" className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm font-semibold focus:border-primary-500 focus:outline-none"
                defaultValue={product.stock}
                onBlur={(event) => handleStockUpdate(product.id, Number(event.target.value))}
              />
              {savingId === product.id && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
            </div>,
            product.stock === 0 ? (
              <Badge key="st" tone="danger">Out of Stock</Badge>
            ) : product.stock <= 20 ? (
              <Badge key="st" tone="warning">Low Stock</Badge>
            ) : (
              <Badge key="st" tone="success">In Stock</Badge>
            ),
            <div key="quick" className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleStockUpdate(product.id, product.stock + 5)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => handleStockUpdate(product.id, product.stock + 10)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                +10
              </button>
              <button
                type="button"
                onClick={() => handleStockUpdate(product.id, Math.max(0, product.stock - 5))}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                -5
              </button>
            </div>
          ])}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. Seller Orders
// ---------------------------------------------------------------------------
const SellerOrders = () => {
  const { orders } = useApp();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Store Orders</h2>
        <p className="text-sm text-slate-500">
          Customer orders containing your listed products. Customer contact details are masked for privacy.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No orders received yet.
        </div>
      ) : (
        <DataTable
          headers={["Order", "Date", "Customer", "Items", "Payment", "Delivery", "My Total", "Details"]}
          rows={orders.map((order) => [
            <span key="num" className="font-mono font-semibold text-slate-900">{order.orderNumber}</span>,
            new Date(order.date).toLocaleDateString(),
            <div>
              <div className="font-medium text-slate-800">{order.deliveryAddress?.name || "Customer"}</div>
              <div className="text-xs text-slate-400">
                {order.deliveryAddress?.city}, {order.deliveryAddress?.region}
              </div>
            </div>,
            order.items.length,
            <Badge key="pay" tone={order.paymentStatus === "Paid" ? "success" : "warning"}>
              {order.paymentStatus}
            </Badge>,
            <Badge key="del" tone={order.status === "Delivered" ? "success" : "primary"}>
              {order.status}
            </Badge>,
            <span key="tot" className="font-semibold text-slate-900">{formatCurrency(order.total)}</span>,
            <Button
              key="btn"
              variant="secondary"
              className="min-h-8 px-2.5 py-1 text-xs"
              onClick={() => setSelectedOrder(order)}
            >
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
          ])}
        />
      )}

      {selectedOrder && (
        <Modal title={`Order Details: ${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <div>
                <span className="font-semibold text-slate-600">Customer:</span>{" "}
                {selectedOrder.deliveryAddress?.name || "Customer"}
              </div>
              <div>
                <span className="font-semibold text-slate-600">Location:</span>{" "}
                {selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.region}{" "}
                {selectedOrder.deliveryAddress?.postalCode}
              </div>
              <div>
                <span className="font-semibold text-slate-600">Order Status:</span> {selectedOrder.status}
              </div>
              <div>
                <span className="font-semibold text-slate-600">Payment Status:</span> {selectedOrder.paymentStatus}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">Items Ordered</h4>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.product.images[0] || "/placeholder.png"}
                        alt={item.product.name}
                        className="h-10 w-10 rounded border border-slate-200 object-cover"
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{item.product.name}</div>
                        <div className="text-xs text-slate-400">Qty: {item.quantity}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {formatCurrency(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold">
              <span>Total:</span>
              <span>{formatCurrency(selectedOrder.total)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. Seller Reports
// ---------------------------------------------------------------------------
const SellerReports = () => {
  const { user, products, orders, categories } = useApp();

  const myProducts = useMemo(
    () => products.filter((p) => !user || user.role !== "seller" || p.sellerId === user.id),
    [products, user]
  );

  const grouped = useMemo(() => {
    return categories.map((category) => {
      const count = myProducts.filter((p) => p.category === category.name).length;
      return { category: category.name, value: count };
    });
  }, [categories, myProducts]);

  const stockHealth = useMemo(() => {
    const total = myProducts.length || 1;
    const outOfStock = myProducts.filter((p) => p.stock === 0).length;
    const lowStock = myProducts.filter((p) => p.stock > 0 && p.stock <= 20).length;
    const inStock = myProducts.filter((p) => p.stock > 20).length;
    return {
      outOfStock,
      lowStock,
      inStock,
      inStockPct: Math.round((inStock / total) * 100)
    };
  }, [myProducts]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Store Analytics & Reports</h2>
        <p className="text-sm text-slate-500">
          Insights into your catalog distribution, inventory health, and revenue breakdown.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Healthy Stock %</div>
          <div className="mt-2 text-3xl font-black text-emerald-600">{stockHealth.inStockPct}%</div>
          <p className="mt-1 text-xs text-slate-400">
            {stockHealth.inStock} out of {myProducts.length} items have over 20 units in stock.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Order Value</div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            {formatCurrency(
              orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Across {orders.length} total orders.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Attention Required</div>
          <div className="mt-2 text-3xl font-black text-rose-600">{stockHealth.outOfStock}</div>
          <p className="mt-1 text-xs text-slate-400">Items currently completely out of stock.</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-bold text-slate-900">Catalog Category Distribution</h3>
        <p className="text-xs text-slate-500">Number of listed products across department categories.</p>

        <div className="mt-6 space-y-4">
          {grouped.map((item) => (
            <div key={item.category}>
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">{item.category}</span>
                <span className="text-slate-500">
                  {item.value} product{item.value === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary-600 transition-all duration-300"
                  style={{
                    width: `${
                      myProducts.length > 0 ? Math.min(100, Math.round((item.value / myProducts.length) * 100)) : 0
                    }%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
  step
}: InputProps) => (
  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
    {label}
    <input
      type={type}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900 focus:border-primary-500 focus:outline-none"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

