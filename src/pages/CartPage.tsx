import { Link } from "react-router-dom";
import { CartItem } from "../components/CartItem";
import { Button, EmptyState, SectionHeader } from "../components/ui";
import { useApp } from "../context/AppContext";
import { cartService } from "../services/cartService";
import { formatCurrency } from "../utils/format";

export const CartPage = () => {
  const { cart, authLoading } = useApp();
  const totals = cartService.totals(cart);

  if (authLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px] animate-pulse">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-7 w-40 rounded bg-slate-200" />
          <div className="h-24 rounded bg-slate-100" />
          <div className="h-24 rounded bg-slate-100" />
        </section>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-6 w-32 rounded bg-slate-200" />
          <div className="space-y-2">
            <div className="h-4 rounded bg-slate-100" />
            <div className="h-4 rounded bg-slate-100" />
            <div className="h-4 rounded bg-slate-100" />
          </div>
          <div className="h-10 rounded bg-slate-200" />
        </aside>
      </div>
    );
  }

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState title="Your cart is empty" message="Add electronics, clothing, home products, groceries, books, or anything else from the marketplace." action={<Link to="/products"><Button>Continue Shopping</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader title="Shopping Cart" eyebrow={`${cart.length} mixed-category items`} />
        {cart.map((item) => <CartItem key={item.product.id} item={item} />)}
      </section>
      <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Order Summary</h2>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{formatCurrency(totals.deliveryFee)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(totals.discount)}</span></div>
          <div className="border-t border-slate-200 pt-3 text-base font-bold flex justify-between"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
        </div>
        <Link to="/checkout" className="mt-5 block"><Button className="w-full">Proceed to Checkout</Button></Link>
      </aside>
    </div>
  );
};
