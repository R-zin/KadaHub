import { Heart, Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { CartItem as CartItemType } from "../types";
import { formatCurrency } from "../utils/format";
import { IconButton } from "./ui";

export const CartItem = ({ item }: { item: CartItemType }) => {
  const { updateCartQuantity, removeFromCart, toggleWishlist } = useApp();
  return (
    <div className="grid gap-4 border-b border-slate-100 py-4 sm:grid-cols-[96px_1fr_auto]">
      <img src={item.product.images[0]} alt={item.product.name} className="h-24 w-24 rounded-lg object-cover" />
      <div>
        <Link to={`/products/${item.product.id}`} className="font-semibold text-slate-950 hover:text-primary-700">{item.product.name}</Link>
        <p className="mt-1 text-sm text-slate-500">{item.product.brand} · {item.product.category}</p>
        <p className="mt-2 font-semibold">{formatCurrency(item.product.price)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <IconButton label="Decrease quantity" onClick={() => updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))}><Minus className="h-4 w-4" /></IconButton>
          <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 px-3 font-semibold">{item.quantity}</span>
          <IconButton label="Increase quantity" onClick={() => updateCartQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))}><Plus className="h-4 w-4" /></IconButton>
          <IconButton label="Move to wishlist" onClick={() => toggleWishlist(item.product)}><Heart className="h-4 w-4" /></IconButton>
          <IconButton label="Remove item" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      </div>
      <div className="font-bold text-slate-950">{formatCurrency(item.product.price * item.quantity)}</div>
    </div>
  );
};
