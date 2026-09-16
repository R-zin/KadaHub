import { Link } from "react-router-dom";
import { OrderTimeline } from "../components/OrderTimeline";
import { StatusBadge } from "../components/StatusBadge";
import { Button, EmptyState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { compactDate, formatCurrency } from "../utils/format";

export const OrdersPage = () => {
  const { orders, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse">
        <div className="h-9 w-36 rounded bg-slate-200" />
        <div className="mt-6 grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-4 w-64 rounded bg-slate-200" />
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded bg-slate-200" />
                <div className="h-16 w-16 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          title="No orders yet"
          message="When you complete checkout, your order and live tracking will appear here."
          action={<Link to="/products"><Button>Start Shopping</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-black">Orders</h1>
      <div className="mt-6 grid gap-4">
        {orders.map((order) => (
          <article key={order.id} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_260px]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold">#{order.orderNumber}</h2>
                <StatusBadge status={order.status} />
                <StatusBadge status={order.paymentStatus} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{compactDate(order.date)} · {order.items.length} item groups · {formatCurrency(order.total)}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {order.items.map((item) => <img key={item.product.id} src={item.product.images[0]} alt={item.product.name} className="h-16 w-16 rounded-md object-cover" />)}
              </div>
              <Link to={`/orders/${order.id}`} className="mt-4 inline-flex"><Button variant="secondary">View Details</Button></Link>
            </div>
            <OrderTimeline status={order.status} />
          </article>
        ))}
      </div>
    </div>
  );
};
