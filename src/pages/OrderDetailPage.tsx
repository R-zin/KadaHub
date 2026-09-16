import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { OrderTimeline } from "../components/OrderTimeline";
import { StatusBadge } from "../components/StatusBadge";
import { Button, EmptyState, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { compactDate, formatCurrency } from "../utils/format";

export const OrderDetailPage = () => {
  const { orderId } = useParams();
  const { orders, returns, addReturnRequest, authLoading } = useApp();
  const [reason, setReason] = useState("Size or fit issue");
  const [requestingProductId, setRequestingProductId] = useState<string | null>(null);
  const [returnError, setReturnError] = useState("");
  const [returnSuccess, setReturnSuccess] = useState("");

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="h-8 w-48 rounded bg-slate-200" />
            <div className="h-4 w-36 rounded bg-slate-200" />
            <div className="h-24 rounded bg-slate-100 mt-6" />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="h-6 w-24 rounded bg-slate-200" />
            <div className="h-32 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  const order = orders.find((item) => item.id === orderId);

  if (!order) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState title="Order not found" message="The requested order could not be loaded." />
        <div className="mt-4 text-center">
          <Link to="/orders" className="text-sm font-semibold text-primary-700 hover:underline">
            ← Return to your orders
          </Link>
        </div>
      </div>
    );
  }

  const handleRequestReturn = async (productId: string) => {
    try {
      setRequestingProductId(productId);
      setReturnError("");
      setReturnSuccess("");
      await addReturnRequest(order.id, productId, reason);
      setReturnSuccess("Return request submitted successfully. Our team will review it shortly.");
    } catch (err: any) {
      setReturnError(err?.response?.data?.error?.message || err?.response?.data?.error || (err instanceof Error ? err.message : "Failed to submit return request."));
    } finally {
      setRequestingProductId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/orders" className="text-sm font-semibold text-primary-700">Back to orders</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black">Order #{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
            <StatusBadge status={order.paymentStatus} />
          </div>
          <p className="mt-2 text-slate-500">{compactDate(order.date)} · {formatCurrency(order.total)}</p>

          {returnSuccess && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span>{returnSuccess}</span>
              <button type="button" onClick={() => setReturnSuccess("")} className="ml-2 font-bold text-emerald-700 hover:text-emerald-900">✕</button>
            </div>
          )}

          {returnError && <div className="mt-4"><ErrorState message={returnError} /></div>}

          <div className="mt-6 divide-y divide-slate-100">
            {order.items.map((item) => {
              const activeReturn = returns.find(
                (r) => r.orderId === order.id && r.productId === item.product.id && r.status !== "Rejected"
              );

              return (
                <div key={item.product.id} className="grid gap-4 py-4 sm:grid-cols-[80px_1fr_auto] items-center">
                  <img src={item.product.images[0]} alt={item.product.name} className="h-20 w-20 rounded-md object-cover" />
                  <div>
                    <h2 className="font-semibold">{item.product.name}</h2>
                    <p className="text-sm text-slate-500">{item.product.category} · Qty {item.quantity}</p>
                  </div>
                  {order.status === "Delivered" && (
                    <div>
                      {activeReturn ? (
                        <div className="text-right">
                          <span className="block text-xs font-medium text-slate-500 mb-1">Return Status:</span>
                          <StatusBadge status={activeReturn.status} />
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          disabled={requestingProductId === item.product.id}
                          onClick={() => handleRequestReturn(item.product.id)}
                        >
                          {requestingProductId === item.product.id ? "Submitting..." : "Request Return"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <label className="text-sm font-semibold">Return reason</label>
            <select className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option>Size or fit issue</option><option>Damaged item</option><option>Wrong item received</option><option>Changed mind</option>
            </select>
          </div>
          <h2 className="mt-6 font-bold">Return Requests</h2>
          <div className="mt-3 grid gap-2">
            {returns.filter((item) => item.orderId === order.id).length === 0 ? (
              <p className="text-sm text-slate-500">No returns requested for this order.</p>
            ) : (
              returns.filter((item) => item.orderId === order.id).map((item) => (
                <div key={item.id} className="flex justify-between items-center rounded-md bg-slate-50 p-3 text-sm">
                  <span>{item.productName || item.reason} ({item.reason})</span>
                  <StatusBadge status={item.status} />
                </div>
              ))
            )}
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 font-bold">Tracking</h2><OrderTimeline status={order.status} /></div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">Delivery Address</h2><p className="mt-2 text-sm text-slate-500">{order.deliveryAddress.name}<br />{order.deliveryAddress.line1}<br />{order.deliveryAddress.city}, {order.deliveryAddress.region} {order.deliveryAddress.postalCode}</p></div>
        </aside>
      </div>
    </div>
  );
};
