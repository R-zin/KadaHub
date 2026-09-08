import type { Role, User } from "../types";
import { api, clearToken, setToken } from "./api";

export interface AuthResult {
  user: User;
  token: string;
}

export const authService = {
  register: async (name: string, email: string, password: string, role: Role, storeName?: string): Promise<AuthResult> => {
    const data = await api<AuthResult>("/auth/register", { method: "POST", body: { name, email, password, role, storeName }, auth: false });
    setToken(data.token);
    return data;
  },
  login: async (email: string, password: string): Promise<AuthResult> => {
    const data = await api<AuthResult>("/auth/login", { method: "POST", body: { email, password }, auth: false });
    setToken(data.token);
    return data;
  },
  me: async (): Promise<User> => {
    const data = await api<{ user: User }>("/auth/me");
    return data.user;
  },
  logout: async () => {
    clearToken();
    return true;
  }
};
