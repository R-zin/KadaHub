import { Link } from "react-router-dom";
import { ProductGrid } from "../components/ProductGrid";
import { Button, EmptyState } from "../components/ui";
import { useApp } from "../context/AppContext";

export const WishlistPage = () => {
  const { products, wishlist } = useApp();
  const wished = products.filter((product) => wishlist.includes(product.id));
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-black">Wishlist</h1>
      <p className="mt-2 text-slate-500">Save products from every category and move them to your cart when ready.</p>
      <div className="mt-6">
        {wished.length ? <ProductGrid products={wished} /> : <EmptyState title="Wishlist is empty" message="Use the heart button on any product to save it here." action={<Link to="/products"><Button>Browse Products</Button></Link>} />}
      </div>
    </div>
  );
};
