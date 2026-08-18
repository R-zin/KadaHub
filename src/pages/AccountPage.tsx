import { Bell, Heart, LogOut, MapPin, RotateCcw, Shirt, ShoppingBag, UserRound, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { Button, DashboardCard, EmptyState } from "../components/ui";
import { useApp } from "../context/AppContext";
import { defaultAddress } from "../data/orders";
import { compactDate } from "../utils/format";

export const AccountPage = () => {
  const { user, logout, orders, wishlist, savedTryOns, notifications, returns } = useApp();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl font-black">Customer Account</h1><p className="mt-2 text-slate-500">{user ? `${user.name} · ${user.email}` : "Guest account"}</p></div>
        {user ? <Button variant="secondary" onClick={logout}><LogOut className="h-4 w-4" /> Logout</Button> : <Link to="/login"><Button>Login</Button></Link>}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <DashboardCard title="Orders" value={orders.length} icon={ShoppingBag} />
        <DashboardCard title="Wishlist" value={wishlist.length} icon={Heart} />
        <DashboardCard title="Returns" value={returns.length} icon={RotateCcw} />
        <DashboardCard title="Saved Try-Ons" value={savedTryOns.length} icon={Shirt} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Profile" icon={UserRound}><p>{user?.name ?? "Guest"}</p><p className="text-slate-500">{user?.email ?? "Not signed in"}</p></Panel>
        <Panel title="Addresses" icon={MapPin}><p>{defaultAddress.line1}</p><p className="text-slate-500">{defaultAddress.city}, {defaultAddress.region} {defaultAddress.postalCode}</p></Panel>
        <Panel title="Payment Methods" icon={WalletCards}><p>Demo Visa ending 4242</p><p className="text-slate-500">Mock payment only. No card information is stored.</p></Panel>
        <Panel title="Notifications" icon={Bell}>{notifications.slice(0, 4).map((item) => <p key={item.id} className="rounded-md bg-slate-50 p-2 text-sm">{item.message}</p>)}</Panel>
      </div>
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Try-On Saved Results</h2>
        {savedTryOns.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {savedTryOns.map((result) => (
              <div key={result.id} className="rounded-lg border border-slate-200 p-3">
                <img src={result.previewImage} alt={result.productName} className="h-40 w-full rounded-md object-cover" />
                <p className="mt-2 font-semibold">{result.productName}</p>
                <p className="text-sm text-slate-500">{result.size} · {result.color} · {compactDate(result.createdAt)}</p>
              </div>
            ))}
          </div>
        ) : <div className="mt-4"><EmptyState title="No saved clothing try-ons" message="Saved results appear here only from eligible clothing products." /></div>}
      </section>
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Returns</h2>
        <div className="mt-4 grid gap-2">
          {returns.map((item) => <div key={item.id} className="flex justify-between rounded-md bg-slate-50 p-3 text-sm"><span>{item.reason}</span><StatusBadge status={item.status} /></div>)}
        </div>
      </section>
    </div>
  );
};

const Panel = ({ title, icon: Icon, children }: { title: string; icon: typeof Bell; children: React.ReactNode }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-3 flex items-center gap-2 font-bold"><Icon className="h-5 w-5 text-primary-700" /> {title}</div>
    <div className="space-y-2 text-sm text-slate-700">{children}</div>
  </section>
);
