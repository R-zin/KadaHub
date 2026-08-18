import { Link, useParams } from "react-router-dom";
import { ProductGrid } from "../components/ProductGrid";
import { Badge, Button, SectionHeader } from "../components/ui";
import { categories } from "../data/categories";
import { useApp } from "../context/AppContext";

export const CategoryPage = () => {
  const { categorySlug } = useParams();
  const { products } = useApp();
  const category = categories.find((item) => item.slug === categorySlug);
  const categoryProducts = category ? products.filter((product) => product.category === category.name) : [];

  if (!category) {
    return <div className="mx-auto max-w-7xl px-4 py-10"><ProductGrid products={[]} /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid lg:grid-cols-[1fr_420px]">
          <div className="p-6 lg:p-10">
            <Badge tone="primary">{category.subcategories.length} subcategories</Badge>
            <h1 className="mt-4 text-3xl font-black text-slate-950">{category.name}</h1>
            <p className="mt-3 max-w-2xl text-slate-600">{category.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {category.subcategories.map((subcategory) => <span key={subcategory} className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">{subcategory}</span>)}
            </div>
            {category.slug === "clothing" && (
              <div className="mt-6 rounded-lg border border-primary-100 bg-primary-50 p-4">
                <h2 className="font-semibold text-primary-800">Try Before You Buy</h2>
                <p className="mt-1 text-sm text-primary-700">Selected shirts, T-shirts, dresses, jackets, jeans, and traditional clothing support Virtual Try-On.</p>
              </div>
            )}
          </div>
          <img src={category.image} alt={category.name} className="h-64 w-full object-cover lg:h-full" />
        </div>
      </section>
      <section className="py-8">
        <SectionHeader title={`${category.name} Products`} action={<Link to="/products"><Button variant="secondary">All Products</Button></Link>} />
        <ProductGrid products={categoryProducts} />
      </section>
    </div>
  );
};
