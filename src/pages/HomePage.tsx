import { ArrowRight, ShieldCheck, Truck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { CategoryCard } from "../components/CategoryCard";
import { ProductGrid } from "../components/ProductGrid";
import { Button, SectionHeader } from "../components/ui";
import { categories } from "../data/categories";
import { useApp } from "../context/AppContext";

export const HomePage = () => {
  const { products } = useApp();
  const featured = products.filter((product) => product.isFeatured).slice(0, 8);
  const electronics = products.filter((product) => product.category === "Electronics").slice(0, 4);
  const home = products.filter((product) => product.category === "Home & Living").slice(0, 4);
  const tryOnProducts = products.filter((product) => product.category === "Clothing" && product.isVirtualTryOnSupported).slice(0, 4);

  return (
    <>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_460px] lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Multi-category marketplace</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">Shop Everything. All in One Place.</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600">Discover products across fashion, electronics, home, beauty and more with carts, checkout, orders, delivery tracking, and role-based management.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/products"><Button>Shop Now <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/category/electronics"><Button variant="secondary">Explore Categories</Button></Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, label: "Tracked delivery" },
                { icon: WalletCards, label: "Mock secure payment" },
                { icon: ShieldCheck, label: "Returns supported" }
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <Icon className="h-5 w-5 text-primary-700" /> {label}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {products.slice(0, 4).map((product) => (
              <Link key={product.id} to={`/products/${product.id}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img src={product.images[0]} alt={product.name} className="h-36 w-full object-cover transition group-hover:scale-105 sm:h-44" />
                <div className="p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">{product.category}</p>
                  <p className="line-clamp-1 font-semibold text-slate-950">{product.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <SectionHeader eyebrow="Departments" title="Browse Every Major Category" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => <CategoryCard key={category.id} category={category} />)}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <SectionHeader eyebrow="Featured" title="Popular Across the Marketplace" action={<Link to="/products" className="font-semibold text-primary-700">View all</Link>} />
        <ProductGrid products={featured} />
      </section>
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Clothing feature</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Try Before You Buy</h2>
            <p className="mt-3 text-slate-600">Selected clothing products support a simulated Virtual Try-On flow. It stays hidden for electronics, home, books, groceries, and other unsupported products.</p>
            <Link to="/category/clothing" className="mt-5 inline-flex font-semibold text-primary-700">Explore eligible clothing</Link>
          </div>
          <ProductGrid products={tryOnProducts} />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <SectionHeader eyebrow="Electronics" title="Trending Tech" />
        <ProductGrid products={electronics} />
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10">
        <SectionHeader eyebrow="Home & Living" title="Practical Home Picks" />
        <ProductGrid products={home} />
      </section>
    </>
  );
};
