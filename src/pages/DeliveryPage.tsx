import { ClipboardList, MapPin, PackageCheck, Route, Truck } from "lucide-react";
import { Routes, Route as RouterRoute, Link } from "react-router-dom";
import { DashboardCard, DataTable, Button } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { useApp } from "../context/AppContext";
import { deliveryService } from "../services/deliveryService";
import { formatCurrency } from "../utils/format";

const navItems = [
  { label: "Dashboard", to: "/delivery", icon: Truck },
  { label: "Assigned Orders", to: "/delivery/orders", icon: ClipboardList },
  { label: "Out for Delivery", to: "/delivery/orders/out", icon: Route }
];

export const DeliveryPage = () => (
  <DashboardLayout title="Delivery Dashboard" navItems={navItems}>
    <Routes>
      <RouterRoute index element={<DeliveryOverview />} />
      <RouterRoute path="orders/*" element={<DeliveryOrders />} />
    </Routes>
  </DashboardLayout>
);

const DeliveryOverview = () => {
  const { orders } = useApp();
  const stats = deliveryService.stats(orders);
  return (
    <div>
      <h2 className="text-2xl font-black">Delivery Statistics</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-5">
        <DashboardCard title="Assigned" value={stats.assigned} icon={ClipboardList} />
        <DashboardCard title="Pending" value={stats.pending} icon={PackageCheck} />
        <DashboardCard title="Out for Delivery" value={stats.outForDelivery} icon={Truck} />
        <DashboardCard title="Delivered" value={stats.delivered} icon={PackageCheck} />
        <DashboardCard title="Failed Attempts" value={stats.failed} icon={MapPin} />
      </div>
      <div className="mt-6"><DeliveryOrders /></div>
    </div>
  );
};

const DeliveryOrders = () => {
  const { orders, updateOrderStatus } = useApp();
  return (
    <div>
      <h2 className="text-xl font-bold">Assigned Orders</h2>
      <div className="mt-4">
        <DataTable
          headers={["Order", "Customer", "Address", "Status", "Total", "Action"]}
          rows={orders.map((order) => [
            <Link className="font-semibold text-primary-700" to={`/orders/${order.id}`}>{order.orderNumber}</Link>,
            order.deliveryAddress.name,
            `${order.deliveryAddress.line1}, ${order.deliveryAddress.city}`,
            <StatusBadge status={order.status} />,
            formatCurrency(order.total),
            <Button className="min-h-8 px-3 py-1" onClick={() => updateOrderStatus(order.id)}>Update Status</Button>
          ])}
        />
      </div>
    </div>
  );
};
