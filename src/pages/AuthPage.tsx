import { KeyRound, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { demoAccounts } from "../services/authService";
import { useApp } from "../context/AppContext";
import type { Role } from "../types";

export const AuthPage = ({ mode }: { mode: "login" | "register" | "forgot" }) => {
  const { login, register } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("New Demo User");
  const [email, setEmail] = useState("new@demo.com");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "register") register(name, email, role);
    else login(role);
    navigate(role === "seller" ? "/seller" : role === "delivery" ? "/delivery" : role === "admin" ? "/admin" : "/");
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_420px]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-700">Role-based demo access</p>
        <h1 className="mt-3 text-4xl font-black text-slate-950">{mode === "register" ? "Create an account" : mode === "forgot" ? "Reset password" : "Login to KadaHub"}</h1>
        <p className="mt-4 text-slate-600">Choose a demo role to experience customer shopping, seller management, delivery updates, or administrator monitoring.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {demoAccounts.map((account) => (
            <button key={account.role} onClick={() => setRole(account.role)} className={`rounded-lg border p-4 text-left ${role === account.role ? "border-primary-600 bg-primary-50" : "border-slate-200 bg-white"}`}>
              <p className="font-semibold capitalize">{account.role}</p>
              <p className="text-sm text-slate-500">{account.email}</p>
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-md bg-primary-50 text-primary-700">
          {mode === "register" ? <UserPlus className="h-6 w-6" /> : mode === "forgot" ? <KeyRound className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
        </div>
        {mode === "register" && <label className="block text-sm font-medium text-slate-700">Name<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label className="mt-4 block text-sm font-medium text-slate-700">Email<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {mode !== "forgot" && <label className="mt-4 block text-sm font-medium text-slate-700">Password<input className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2" type="password" value="demo-password" readOnly /></label>}
        <Button className="mt-6 w-full">{mode === "forgot" ? <><Mail className="h-4 w-4" /> Send Reset Link</> : mode === "register" ? "Register" : "Login"}</Button>
        <div className="mt-4 flex justify-between text-sm font-semibold text-primary-700">
          <Link to="/login">Login</Link><Link to="/register">Register</Link><Link to="/forgot-password">Forgot password</Link>
        </div>
      </form>
    </div>
  );
};
