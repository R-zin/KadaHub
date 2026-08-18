import { CheckCircle2, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { defaultAddress } from "../data/orders";
import { cartService } from "../services/cartService";
import type { Address } from "../types";
import { formatCurrency } from "../utils/format";

const steps = ["Address", "Delivery", "Payment", "Review", "Confirmation"];

export const CheckoutPage = () => {
  const { cart, checkout } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(defaultAddress);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const totals = cartService.totals(cart);

  if (!cart.length && !orderNumber) {
    return <div className="mx-auto max-w-5xl px-4 py-10"><EmptyState title="Nothing to checkout" message="Add products from any category to create a mock order." action={<Link to="/products"><Button>Shop Products</Button></Link>} /></div>;
  }

  const placeOrder = async () => {
    try {
      setProcessing(true);
      setError("");
      const order = await checkout(address);
      setOrderNumber(order.orderNumber);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-black text-slate-950">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 grid gap-2 sm:grid-cols-5">
            {steps.map((label, index) => (
              <div key={label} className={`rounded-md px-3 py-2 text-center text-sm font-semibold ${index <= step ? "bg-primary-50 text-primary-700" : "bg-slate-100 text-slate-500"}`}>{label}</div>
            ))}
          </div>
          {error && <ErrorState message={error} />}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(address).map(([key, value]) => (
                <label key={key} className="block text-sm font-medium capitalize text-slate-700">
                  {key}
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={value} onChange={(event) => setAddress({ ...address, [key]: event.target.value })} />
                </label>
              ))}
            </div>
          )}
          {step === 1 && <Panel icon={Truck} title="Delivery Method" message="Standard tracked delivery is selected. Delivery fee is calculated from your cart total." />}
          {step === 2 && <Panel icon={CreditCard} title="Mock Payment" message="Use the demo payment button. No card data is collected or stored." />}
          {step === 3 && <Panel icon={PackageCheck} title="Review Order" message="Stock is verified before the mock payment succeeds and the order is created." />}
          {step === 4 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h2 className="mt-4 text-2xl font-bold">Order confirmed</h2>
              <p className="mt-2 text-slate-500">Your order #{orderNumber} was created after successful mock payment.</p>
              <Button className="mt-6" onClick={() => navigate("/orders")}>View Orders</Button>
            </div>
          )}
          {step < 4 && (
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
              {step < 3 ? <Button onClick={() => setStep(step + 1)}>Continue</Button> : <Button disabled={processing} onClick={placeOrder}>{processing ? "Processing..." : "Pay and Place Order"}</Button>}
            </div>
          )}
        </section>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Summary</h2>
          <div className="mt-4 space-y-3">
            {cart.map((item) => (
              <div key={item.product.id} className="flex gap-3 text-sm">
                <img src={item.product.images[0]} alt={item.product.name} className="h-12 w-12 rounded-md object-cover" />
                <div className="flex-1"><p className="font-semibold">{item.product.name}</p><p className="text-slate-500">{item.quantity} · {item.product.category}</p></div>
                <span>{formatCurrency(item.product.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 font-bold flex justify-between"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
        </aside>
      </div>
    </div>
  );
};

const Panel = ({ icon: Icon, title, message }: { icon: typeof MapPin; title: string; message: string }) => (
  <div className="rounded-lg bg-slate-50 p-8 text-center">
    <Icon className="mx-auto h-10 w-10 text-primary-700" />
    <h2 className="mt-3 text-xl font-bold">{title}</h2>
    <p className="mx-auto mt-2 max-w-lg text-slate-500">{message}</p>
  </div>
);
