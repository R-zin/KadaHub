import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, LoaderCircle, X } from "lucide-react";
import { Link } from "react-router-dom";

export const Badge = ({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "success" | "warning" | "danger" }) => {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    primary: "bg-primary-50 text-primary-700 border-primary-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100"
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
};

export const Button = ({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) => {
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700",
    secondary: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700"
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const IconButton = ({ label, children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button
    aria-label={label}
    title={label}
    className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 ${className}`}
    {...props}
  >
    {children}
  </button>
);

export const DashboardCard = ({ title, value, icon: Icon, detail }: { title: string; value: string | number; icon: LucideIcon; detail?: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      </div>
      <div className="rounded-md bg-primary-50 p-3 text-primary-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    {detail && <p className="mt-3 text-sm text-slate-500">{detail}</p>}
  </div>
);

export const EmptyState = ({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
    <Inbox className="mx-auto h-10 w-10 text-slate-400" />
    <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const LoadingState = ({ label = "Loading" }: { label?: string }) => (
  <div className="flex min-h-40 items-center justify-center gap-3 text-slate-600">
    <LoaderCircle className="h-5 w-5 animate-spin" />
    <span>{label}</span>
  </div>
);

export const ErrorState = ({ message }: { message: string }) => (
  <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
    <div className="flex gap-2">
      <AlertTriangle className="h-5 w-5" />
      <span>{message}</span>
    </div>
  </div>
);

export const Modal = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <IconButton label="Close" onClick={onClose}>
          <X className="h-5 w-5" />
        </IconButton>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export const SectionHeader = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) => (
  <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
    <div>
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">{eyebrow}</p>}
      <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
    </div>
    {action}
  </div>
);

export const DataTable = ({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) => (
  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const PageLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link className="text-sm font-semibold text-primary-700 hover:text-primary-800" to={to}>
    {children}
  </Link>
);
