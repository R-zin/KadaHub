/**
 * Central API client for the KadaHub backend.
 * Handles the base URL, JSON, auth token, and the sliding-session refresh token.
 */

const BASE_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "kadahub_token";

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
};
export const clearToken = () => setToken(null);

export class ApiError extends Error {
  status: number;
  details?: string[];
  constructor(message: string, status: number, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  auth?: boolean; // default true
}

export const api = async <T = any>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = "GET", body, formData, auth = true } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (auth && token) headers["authorization"] = `Bearer ${token}`;
  if (body !== undefined && !formData) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    throw new ApiError("Cannot reach the server. Check that the API is running.", 0);
  }

  // Sliding session: adopt the refreshed token if the server sent one.
  const refreshed = res.headers.get("X-Refresh-Token");
  if (refreshed) setToken(refreshed);

  // Session expired -> force a local logout signal.
  if (res.status === 401 && auth) {
    clearToken();
    window.dispatchEvent(new CustomEvent("kadahub:session-expired"));
  }

  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data?.error?.details);
  }
  return data as T;
};
