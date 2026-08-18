import { Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { Product } from "../types";
import { canUseVirtualTryOn } from "../services/tryOnService";
import { Badge, Button, IconButton } from "./ui";
import { PriceDisplay } from "./PriceDisplay";
import { RatingStars } from "./RatingStars";

export const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart, wishlist, toggleWishlist } = useApp();
  const wished = wishlist.includes(product.id);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <Link to={`/products/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100">
        <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.isNew && <Badge tone="primary">NEW</Badge>}
          {product.isBestSeller && <Badge tone="success">BEST SELLER</Badge>}
          {product.stock <= 20 && product.stock > 0 && <Badge tone="warning">LOW STOCK</Badge>}
          {product.stock === 0 && <Badge tone="danger">OUT OF STOCK</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{product.brand}</p>
            <Link to={`/products/${product.id}`} className="mt-1 line-clamp-2 font-semibold text-slate-950 hover:text-primary-700">
              {product.name}
            </Link>
          </div>
          <IconButton label={wished ? "Remove from wishlist" : "Add to wishlist"} onClick={() => toggleWishlist(product)} className={wished ? "text-rose-600" : ""}>
            <Heart className={`h-5 w-5 ${wished ? "fill-rose-600" : ""}`} />
          </IconButton>
        </div>
        <div className="mt-3"><RatingStars rating={product.rating} count={product.reviewCount} /></div>
        <div className="mt-3"><PriceDisplay price={product.price} originalPrice={product.originalPrice} discount={product.discount} /></div>
        {canUseVirtualTryOn(product) && <div className="mt-3"><Badge tone="primary">VIRTUAL TRY-ON</Badge></div>}
        <div className="mt-auto pt-4">
          <Button className="w-full" disabled={product.stock === 0} onClick={() => addToCart(product)}>
            <ShoppingCart className="h-4 w-4" /> Add to Cart
          </Button>
        </div>
      </div>
    </article>
  );
};
