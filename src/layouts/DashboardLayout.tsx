import type { LucideIcon } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

export const DashboardLayout = ({
  title,
  navItems,
  children
}: {
  title: string;
  navItems: { label: string; to: string; icon: LucideIcon }[];
  children: React.ReactNode;
}) => (
  <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Link to="/" className="text-sm font-semibold text-primary-700">Back to marketplace</Link>
      <h1 className="mt-4 text-xl font-bold text-slate-950">{title}</h1>
      <nav className="mt-5 grid gap-1">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to.split("/").length <= 2}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${isActive ? "bg-primary-50 text-primary-700" : "text-slate-700 hover:bg-slate-100"}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <section>{children}</section>
  </div>
);
