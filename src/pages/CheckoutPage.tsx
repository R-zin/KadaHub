import { CheckCircle2, CreditCard, MapPin, PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { defaultAddress } from "../constants";
import { cartService } from "../services/cartService";
import { orderService } from "../services/orderService";
import type { Address } from "../types";
import { formatCurrency } from "../utils/format";

const steps = ["Address", "Delivery", "Payment", "Review", "Confirmation"];

let razorpayScriptPromise: Promise<boolean> | null = null;
const loadRazorpayScript = (): Promise<boolean> => {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
};

export const CheckoutPage = () => {
  const { user, cart, checkout } = useApp();
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

  const validateAddress = (addr: Address): string | null => {
    if (!addr.name?.trim()) return "Recipient name is required.";
    if (!addr.line1?.trim()) return "Street address line 1 is required.";
    if (!addr.city?.trim()) return "City is required.";
    if (!addr.postalCode?.trim()) return "Postal code is required.";
    return null;
  };

  const handleNextStep = () => {
    if (step === 0) {
      const err = validateAddress(address);
      if (err) {
        setError(err);
        return;
      }
    }
    setError("");
    setStep(step + 1);
  };

  const placeOrder = async () => {
    if (processing) return;
    try {
      setProcessing(true);
      setError("");

      // 1. Create server-authoritative Razorpay order
      const rzpOrder = await orderService.createRazorpayOrder();

      const rzpKey = rzpOrder.key_id || (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
      const isMock = rzpOrder.order_id.startsWith("order_mock_") || !rzpKey || rzpKey === "rzp_test_mockkeyid123" || rzpKey.includes("mock");

      // 2. Only invoke live Razorpay SDK when real Razorpay credentials are present
      if (!isMock) {
        const loaded = await loadRazorpayScript();
        if (loaded && (window as any).Razorpay) {
        const options = {
          key: rzpKey,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency || "INR",
          name: "KadaHub",
          description: `Order Payment (${cart.length} item${cart.length > 1 ? "s" : ""})`,
          order_id: rzpOrder.order_id,
          prefill: {
            name: address.name,
            contact: address.phone,
            email: user?.email || ""
          },
          theme: {
            color: "#0f172a"
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              setProcessing(true);
              const order = await checkout(address, {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              });
              setOrderNumber(order.orderNumber);
              setStep(4);
            } catch (checkoutErr: any) {
              const msg = checkoutErr?.message || "Payment verification failed. Please contact support if money was deducted.";
              setError(msg);
            } finally {
              setProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setProcessing(false);
              setError("Payment cancelled. Your cart has not been changed.");
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          setProcessing(false);
          const failMsg = response?.error?.description || "Payment failed. Please try again.";
          setError(failMsg);
        });
        rzp.open();
        return;
      }
    }

      // Offline / test fallback when script cannot be reached (e.g. sandbox or mock driver)
      const order = await checkout(address, {
        razorpay_order_id: rzpOrder.order_id,
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_signature: "mock_sig_valid_test_token_12345"
      });
      setOrderNumber(order.orderNumber);
      setStep(4);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.error || (err instanceof Error ? err.message : "Payment failed. Your cart and inventory have not been changed.");
      setError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-black text-slate-950">Checkout</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 grid grid-cols-5 gap-1 text-[11px] sm:gap-2 sm:text-sm">
            {steps.map((label, index) => (
              <div
                key={label}
                className={`truncate rounded-md px-1.5 py-2 text-center font-semibold sm:px-3 ${
                  index <= step ? "bg-primary-50 text-primary-700 font-bold" : "bg-slate-100 text-slate-500"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          {error && <div className="mb-4"><ErrorState message={error} /></div>}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(address).map(([key, value]) => (
                <label key={key} className="block text-sm font-medium capitalize text-slate-700">
                  {key.replace(/([A-Z])/g, " $1")}
                  <input
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    value={value}
                    onChange={(event) => {
                      setError("");
                      setAddress({ ...address, [key]: event.target.value });
                    }}
                  />
                </label>
              ))}
            </div>
          )}
          {step === 1 && <Panel icon={Truck} title="Delivery Method" message="Standard tracked delivery is selected. Delivery fee is calculated from your cart total." />}
          {step === 2 && <Panel icon={CreditCard} title="Razorpay Payment" message="Pay securely via Razorpay Standard Checkout. UPI, credit/debit cards, net banking, and wallets are supported." />}
          {step === 3 && <Panel icon={PackageCheck} title="Review Order" message="Stock is verified before the payment modal opens and your order is confirmed." />}
          {step === 4 && (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <h2 className="mt-4 text-2xl font-bold">Order confirmed</h2>
              <p className="mt-2 text-slate-500">Your order #{orderNumber} was confirmed after successful payment.</p>
              <Button className="mt-6" onClick={() => navigate("/orders")}>View Orders</Button>
            </div>
          )}
          {step < 4 && (
            <div className="mt-6 flex justify-between">
              <Button variant="secondary" disabled={step === 0} onClick={() => { setError(""); setStep(step - 1); }}>Back</Button>
              {step < 3 ? <Button onClick={handleNextStep}>Continue</Button> : <Button disabled={processing} onClick={placeOrder}>{processing ? "Processing..." : "Pay and Place Order"}</Button>}
            </div>
          )}
        </section>
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold">Summary</h2>
          <div className="mt-4 space-y-3">
            {cart.map((item) => (
              <div key={item.product.id} className="flex gap-3 text-sm">
                <img
                  src={(item.product.images && item.product.images[0]) || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=80"}
                  alt={item.product.name}
                  className="h-12 w-12 rounded-md object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120&auto=format&fit=crop&q=80";
                  }}
                />
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
