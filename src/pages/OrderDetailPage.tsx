import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { OrderTimeline } from "../components/OrderTimeline";
import { StatusBadge } from "../components/StatusBadge";
import { Button, EmptyState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { compactDate, formatCurrency } from "../utils/format";

export const OrderDetailPage = () => {
  const { orderId } = useParams();
  const { orders, returns, addReturnRequest } = useApp();
  const [reason, setReason] = useState("Size or fit issue");
  const order = orders.find((item) => item.id === orderId);

  if (!order) return <div className="mx-auto max-w-5xl px-4 py-10"><EmptyState title="Order not found" message="The requested order could not be loaded." /></div>;

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
          <div className="mt-6 divide-y divide-slate-100">
            {order.items.map((item) => (
              <div key={item.product.id} className="grid gap-4 py-4 sm:grid-cols-[80px_1fr_auto]">
                <img src={item.product.images[0]} alt={item.product.name} className="h-20 w-20 rounded-md object-cover" />
                <div><h2 className="font-semibold">{item.product.name}</h2><p className="text-sm text-slate-500">{item.product.category} · Qty {item.quantity}</p></div>
                {order.status === "Delivered" && <Button variant="secondary" onClick={() => addReturnRequest(order.id, item.product.id, reason)}>Request Return</Button>}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <label className="text-sm font-semibold">Return reason</label>
            <select className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" value={reason} onChange={(event) => setReason(event.target.value)}>
              <option>Size or fit issue</option><option>Damaged item</option><option>Wrong item received</option><option>Changed mind</option>
            </select>
          </div>
          <h2 className="mt-6 font-bold">Return Requests</h2>
          <div className="mt-3 grid gap-2">
            {returns.filter((item) => item.orderId === order.id).map((item) => <div key={item.id} className="flex justify-between rounded-md bg-slate-50 p-3 text-sm"><span>{item.reason}</span><StatusBadge status={item.status} /></div>)}
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
