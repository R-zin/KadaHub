/**
 * Central API client for the KadaHub backend.
 * Handles the base URL, JSON, auth token, and the sliding-session refresh token.
 */

const resolveApiBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    const trimmed = String(envUrl).replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "/api";
  }
  return "http://localhost:4000/api";
};

const BASE_URL = resolveApiBaseUrl();
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
  timeoutMs?: number; // default 25000ms
}

export const api = async <T = any>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = "GET", body, formData, auth = true, timeoutMs = 25000 } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (auth && token) headers["authorization"] = `Bearer ${token}`;
  if (body !== undefined && !formData) headers["content-type"] = "application/json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (networkErr: any) {
    if (networkErr?.name === "AbortError") {
      throw new ApiError("Request timed out. Please check your internet connection and try again.", 408);
    }
    throw new ApiError("Cannot reach the server. Please verify your connection or check that the API is running.", 0);
  } finally {
    clearTimeout(timeoutId);
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
    const rawMessage = data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      (typeof data?.message === "string" ? data.message : null);

    let message = rawMessage;
    if (!message) {
      switch (res.status) {
        case 400: message = "Bad request. Please check the information provided."; break;
        case 401: message = "Your session has expired. Please log in again."; break;
        case 403: message = "You do not have permission to perform this action."; break;
        case 404: message = "The requested resource could not be found."; break;
        case 409: message = "A conflict occurred. Please refresh and try again."; break;
        case 422: message = "The submitted data could not be processed."; break;
        case 429: message = "Too many requests. Please slow down and try again shortly."; break;
        case 500:
        case 502:
        case 503: message = "A server error occurred. Please try again in a few moments."; break;
        default: message = `Request failed (${res.status})`;
      }
    }
    throw new ApiError(message, res.status, data?.error?.details);
  }
  return data as T;
};
