import { Heart, Minus, Plus, ShoppingBag, ShoppingCart, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PriceDisplay } from "../components/PriceDisplay";
import { ProductGrid } from "../components/ProductGrid";
import { RatingStars } from "../components/RatingStars";
import { Badge, Button, EmptyState, IconButton, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";
import { productService } from "../services/productService";
import { canUseVirtualTryOn } from "../services/tryOnService";
import type { Product } from "../types";

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, addToCart, wishlist, toggleWishlist, productsLoading } = useApp();
  const cachedProduct = products.find((item) => item.id === id);
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [fetching, setFetching] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (!cachedProduct && id && !productsLoading) {
      setFetching(true);
      productService
        .getProductById(id)
        .then((prod) => setFetchedProduct(prod))
        .catch(() => setFetchedProduct(null))
        .finally(() => setFetching(false));
    }
  }, [cachedProduct, id, productsLoading]);

  const product = cachedProduct || fetchedProduct;

  if (productsLoading || fetching) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_460px] animate-pulse">
          <div className="h-[460px] rounded-lg bg-slate-200" />
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
            <div className="h-6 w-1/3 rounded bg-slate-200" />
            <div className="h-10 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="h-20 w-full rounded bg-slate-200" />
            <div className="h-12 w-full rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><EmptyState title="Product unavailable" message="This product could not be found or may have been removed." /></div>;
  }

  const related = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const wished = wishlist.includes(product.id);

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_460px]">
        <section>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img
              src={(product.images && product.images[imageIndex]) || FALLBACK_IMAGE}
              alt={product.name}
              className="h-[460px] w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />
          </div>
          {product.images && product.images.length > 0 && (
            <div className="mt-3 flex gap-3">
              {product.images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  aria-label={`View photo ${index + 1} of ${product.name}`}
                  className={`h-20 w-20 overflow-hidden rounded-md border ${index === imageIndex ? "border-primary-600 ring-2 ring-primary-500/30" : "border-slate-200"}`}
                  onClick={() => setImageIndex(index)}
                >
                  <img
                    src={image || FALLBACK_IMAGE}
                    alt={`${product.name} thumbnail ${index + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {product.isNew && <Badge tone="primary">NEW</Badge>}
            {product.isBestSeller && <Badge tone="success">BEST SELLER</Badge>}
            {canUseVirtualTryOn(product) && <Badge tone="primary">Virtual Try-On Available</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-black text-slate-950">{product.name}</h1>
          <p className="mt-2 text-slate-500">{product.brand} · {product.category} · Sold by {product.sellerName}</p>
          <div className="mt-4"><RatingStars rating={product.rating} count={product.reviewCount} /></div>
          <div className="mt-5"><PriceDisplay price={product.price} originalPrice={product.originalPrice} discount={product.discount} /></div>
          <p className="mt-5 text-slate-600">{product.description}</p>
          <p className="mt-4 text-sm font-semibold text-slate-700">Stock: {product.stock > 0 ? `${product.stock} available` : "Out of stock"}</p>
          <div className="mt-5 flex items-center gap-2">
            <IconButton label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus className="h-4 w-4" /></IconButton>
            <span className="inline-flex h-10 min-w-12 items-center justify-center rounded-md border border-slate-200 px-3 font-semibold">{quantity}</span>
            <IconButton label="Increase quantity" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}><Plus className="h-4 w-4" /></IconButton>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Button disabled={product.stock === 0} onClick={() => addToCart(product, quantity)}><ShoppingCart className="h-4 w-4" /> Add to Cart</Button>
            <Button disabled={product.stock === 0} variant="secondary" onClick={() => { addToCart(product, quantity); navigate("/checkout"); }}><ShoppingBag className="h-4 w-4" /> Buy Now</Button>
            <Button variant="secondary" onClick={() => toggleWishlist(product)}><Heart className={`h-4 w-4 ${wished ? "fill-rose-600 text-rose-600" : ""}`} /> Wishlist</Button>
          </div>
          {canUseVirtualTryOn(product) && (
            <div className="mt-6 rounded-lg border border-primary-100 bg-primary-50 p-4">
              <h2 className="font-semibold text-primary-800">Virtual Try-On Available</h2>
              <p className="mt-1 text-sm text-primary-700">Upload a photo or use camera mode to simulate how this supported clothing item may look.</p>
              <Link to={`/try-on/${product.id}`} className="mt-4 inline-flex"><Button><Wand2 className="h-4 w-4" /> Try It On</Button></Link>
            </div>
          )}
          <div className="mt-6 border-t border-slate-200 pt-5">
            <h2 className="font-semibold">Specifications</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 rounded-md bg-slate-50 px-3 py-2">
                  <dt className="text-slate-500">{key}</dt><dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
      <section className="py-10">
        <SectionHeader title="Related Products" />
        <ProductGrid products={related} />
      </section>
      <section className="mb-10 grid gap-4 rounded-lg border border-slate-200 bg-white p-6 md:grid-cols-3">
        {["Great quality and quick delivery.", "Accurate product information.", "Easy returns and helpful tracking."].map((review, index) => (
          <div key={review} className="rounded-lg bg-slate-50 p-4">
            <RatingStars rating={4.5 - index * 0.2} />
            <p className="mt-3 text-sm text-slate-600">{review}</p>
          </div>
        ))}
      </section>
    </div>
  );
};
