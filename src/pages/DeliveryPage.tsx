import { ClipboardList, MapPin, PackageCheck, Truck } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { Routes, Route as RouterRoute, Link } from "react-router-dom";
import { DashboardCard, DataTable, Button, ErrorState } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { useApp } from "../context/AppContext";
import { orderService } from "../services/orderService";
import type { Order } from "../types";
import { formatCurrency } from "../utils/format";

const navItems = [
  { label: "Dashboard", to: "/delivery", icon: Truck },
  { label: "Assigned Orders", to: "/delivery/orders", icon: ClipboardList, end: true },
  { label: "Out for Delivery", to: "/delivery/orders/out", icon: MapPin },
  { label: "Available Orders", to: "/delivery/available", icon: PackageCheck }
];

export const DeliveryPage = () => (
  <DashboardLayout title="Delivery Dashboard" navItems={navItems}>
    <Routes>
      <RouterRoute index element={<DeliveryOverview />} />
      <RouterRoute path="orders" element={<DeliveryOrders filter="assigned" />} />
      <RouterRoute path="orders/out" element={<DeliveryOrders filter="out" />} />
      <RouterRoute path="available" element={<AvailableOrders />} />
    </Routes>
  </DashboardLayout>
);

const DeliveryOverview = () => {
  const { orders } = useApp();
  const stats = {
    assigned: orders.length,
    pending: orders.filter((o) => o.status === "Processing" || o.status === "Dispatched").length,
    outForDelivery: orders.filter((o) => o.status === "Out for Delivery").length,
    delivered: orders.filter((o) => o.status === "Delivered").length,
    failed: 0
  };
  return (
    <div>
      <h2 className="text-2xl font-black">Delivery Statistics</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <Link to="/delivery/orders" className="block hover:opacity-95">
          <DashboardCard title="Assigned" value={stats.assigned} icon={ClipboardList} />
        </Link>
        <Link to="/delivery/orders" className="block hover:opacity-95">
          <DashboardCard title="Pending" value={stats.pending} icon={PackageCheck} />
        </Link>
        <Link to="/delivery/orders/out" className="block hover:opacity-95">
          <DashboardCard title="Out for Delivery" value={stats.outForDelivery} icon={Truck} />
        </Link>
        <Link to="/delivery/orders" className="block hover:opacity-95">
          <DashboardCard title="Delivered" value={stats.delivered} icon={PackageCheck} />
        </Link>
        <div>
          <DashboardCard title="Failed Attempts" value={stats.failed} icon={MapPin} />
        </div>
      </div>
      <div className="mt-6"><DeliveryOrders /></div>
    </div>
  );
};

const DeliveryOrders = ({ filter = "assigned" }: { filter?: "assigned" | "out" }) => {
  const { orders, advanceOrderStatus } = useApp();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const displayedOrders = filter === "out"
    ? orders.filter((o) => o.status === "Out for Delivery")
    : orders;

  const title = filter === "out" ? "Out for Delivery Orders" : "Assigned Orders";

  const handleAdvance = async (orderId: string) => {
    try {
      setUpdatingId(orderId);
      setError("");
      await advanceOrderStatus(orderId);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || "Failed to update order status");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="flex items-center gap-4 text-sm font-semibold text-primary-700">
          {filter === "out" ? (
            <Link to="/delivery/orders" className="hover:underline">
              ← View All Assigned ({orders.length})
            </Link>
          ) : (
            <Link to="/delivery/orders/out" className="hover:underline">
              View Out for Delivery ({orders.filter((o) => o.status === "Out for Delivery").length}) →
            </Link>
          )}
          <Link to="/delivery/available" className="hover:underline">
            Available Orders →
          </Link>
        </div>
      </div>
      {error && <div className="mt-3"><ErrorState message={error} /></div>}
      <div className="mt-4">
        {displayedOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
            {filter === "out" ? "No orders are currently out for delivery." : "No assigned orders found."}
          </div>
        ) : (
          <DataTable
            headers={["Order", "Customer", "Address", "Status", "Total", "Action"]}
            rows={displayedOrders.map((order) => [
              <Link key={order.id} className="font-semibold text-primary-700 hover:underline" to={`/orders/${order.id}`}>
                {order.orderNumber}
              </Link>,
              order.deliveryAddress.name,
              `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}`,
              <StatusBadge status={order.status} />,
              formatCurrency(order.total),
              <Button
                className="min-h-8 px-3 py-1"
                disabled={order.status === "Delivered" || updatingId === order.id}
                onClick={() => handleAdvance(order.id)}
              >
                {updatingId === order.id ? "Updating..." : "Update Status"}
              </Button>
            ])}
          />
        )}
      </div>
    </div>
  );
};

const AvailableOrders = () => {
  const { claimDeliveryOrder } = useApp();
  const [unassigned, setUnassigned] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadUnassigned = useCallback(async () => {
    try {
      setLoading(true);
      const list = await orderService.getUnassignedOrders();
      setUnassigned(list);
    } catch {
      setUnassigned([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnassigned();
  }, [loadUnassigned]);

  const handleClaim = async (id: string) => {
    try {
      setClaimingId(id);
      setError("");
      await claimDeliveryOrder(id);
      await loadUnassigned();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || "Failed to claim order");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold">Available Unassigned Orders</h2>
      <p className="mt-1 text-sm text-slate-500">Orders placed when no delivery agents were active. Claim an order to assign it to yourself.</p>
      {error && <div className="mt-3"><ErrorState message={error} /></div>}
      <div className="mt-4">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading available orders...</div>
        ) : unassigned.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
            No unassigned orders available at this time.
          </div>
        ) : (
          <DataTable
            headers={["Order", "Customer", "Address", "Status", "Total", "Action"]}
            rows={unassigned.map((order) => [
              <span className="font-semibold text-slate-900">{order.orderNumber}</span>,
              order.deliveryAddress.name,
              `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}`,
              <StatusBadge status={order.status} />,
              formatCurrency(order.total),
              <Button
                className="min-h-8 px-3 py-1"
                disabled={claimingId === order.id}
                onClick={() => handleClaim(order.id)}
              >
                {claimingId === order.id ? "Claiming..." : "Claim Order"}
              </Button>
            ])}
          />
        )}
      </div>
    </div>
  );
};
