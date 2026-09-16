import { KeyRound, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, ErrorState } from "../components/ui";
import { useApp } from "../context/AppContext";
import type { Role } from "../types";

const allRoles: { role: Role; label: string; hint: string }[] = [
  { role: "customer", label: "Customer", hint: "Shop, checkout, track orders" },
  { role: "seller", label: "Seller", hint: "Manage products & inventory" },
  { role: "delivery", label: "Delivery Agent", hint: "Update delivery status" },
  { role: "admin", label: "Administrator", hint: "Monitor the whole platform" }
];

const registrationRoles: { role: Role; label: string }[] = [
  { role: "customer", label: "Customer" },
  { role: "seller", label: "Seller" }
];

export const AuthPage = ({ mode }: { mode: "login" | "register" | "forgot" }) => {
  const { login, register } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSessionExpired = searchParams.get("expired") === "inactivity";

  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = mode === "register"
        ? await register(name, email, password, role, storeName || undefined)
        : await login(email, password);
      navigate(user.role === "seller" ? "/seller" : user.role === "delivery" ? "/delivery" : user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Secure role-based access</p>
        <h1 className="mt-3 text-4xl font-black text-slate-950">
          {mode === "register" ? "Create an account" : mode === "forgot" ? "Reset password" : "Login to KadaHub"}
        </h1>
        <p className="mt-4 text-slate-600">
          Sign in to shop as a customer, manage a storefront, deliver orders, or administer the platform. Sessions expire after 15 minutes of inactivity.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {allRoles.map(({ role: r, label, hint }) => (
            <div key={r} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-semibold capitalize">{label}</p>
              <p className="text-sm text-slate-500">{hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Demo accounts (password <code>password123</code>):</p>
          <p className="mt-1">customer@demo.com · seller@demo.com · delivery@demo.com · admin@demo.com</p>
          <p className="mt-2 text-xs text-slate-500">Public registration is open for Customer and Seller accounts. Delivery and Admin roles are provisioned by Platform Administrators.</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-md bg-primary-50 text-primary-700">
          {mode === "register" ? <UserPlus className="h-6 w-6" /> : mode === "forgot" ? <KeyRound className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
        </div>

        {isSessionExpired && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900 shadow-sm">
            Your session expired due to inactivity. Please log in again.
          </div>
        )}

        {error && <div className="mb-4"><ErrorState message={error} /></div>}

        {mode === "forgot" ? (
          <div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Demo Environment Notice</p>
              <p className="mt-1">
                Password reset via email is not configured in this demo environment.
              </p>
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Standard Demo Credentials</p>
              <p className="mt-1">
                All pre-configured accounts use the default password: <code className="rounded bg-slate-200 px-1.5 py-0.5 font-bold">password123</code>
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-600">
                <li><span className="font-medium">Customer:</span> customer@demo.com</li>
                <li><span className="font-medium">Seller:</span> seller@demo.com</li>
                <li><span className="font-medium">Delivery:</span> delivery@demo.com</li>
                <li><span className="font-medium">Admin:</span> admin@demo.com</li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                For custom or production accounts, password resets must be requested through a platform administrator.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link to="/login">
                <Button className="w-full">Return to Login</Button>
              </Link>
              <Link to="/register">
                <Button variant="secondary" className="w-full">Register New Account</Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  Name
                  <input required className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Account Type
                  <select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {registrationRoles.map(({ role: r, label }) => <option key={r} value={r}>{label}</option>)}
                  </select>
                </label>
                {role === "seller" && (
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Storefront name
                    <input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. UrbanWear" />
                  </label>
                )}
              </>
            )}
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Email
              <input required type="email" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Password
              <input required type="password" minLength={6} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <Button disabled={busy} className="mt-6 w-full">
              {busy ? "Please wait..." : mode === "register" ? "Register" : "Login"}
            </Button>
          </form>
        )}

        <div className="mt-4 flex justify-between text-sm font-semibold text-primary-700">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/forgot-password">Forgot password</Link>
        </div>
      </div>
    </div>
  );
};
