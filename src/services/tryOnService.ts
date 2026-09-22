import type { Product, TryOnResult } from "../types";
import { api } from "./api";

export const canUseVirtualTryOn = (product?: Product | null) =>
  Boolean(product && product.category === "Clothing" && product.isVirtualTryOnSupported);

// Backend returns relative "/uploads/..." paths; the SPA runs on a different origin
// (Vite on 5173 vs API on 4000), so they must be absolutized before use as <img src>.
const backendOrigin = () =>
  ((import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
const absolutize = (url: string) =>
  url && url.startsWith("/") ? new URL(url, backendOrigin()).toString() : url;

export const tryOnService = {
  /** Upload an image file to storage; returns its URL for use as a try-on source. */
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("folder", "tryon");
    const data = await api<{ url: string }>("/uploads", { method: "POST", formData });
    const base = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api";
    return new URL(data.url, base.replace(/\/api$/, "")).toString();
  },
  generatePreview: (productId: string, sourceImage: string, size: string, color: string) =>
    api<{ result: TryOnResult }>("/tryon/generate", { method: "POST", body: { productId, sourceImage, size, color } })
      .then((d) => ({ ...d.result, previewImage: absolutize(d.result.previewImage) })),
  getSaved: () =>
    api<{ results: TryOnResult[] }>("/tryon")
      .then((d) => d.results.map((r) => ({ ...r, previewImage: absolutize(r.previewImage) }))),
  cleanupTempImage: async (urlOrPath: string): Promise<void> => {
    if (!urlOrPath) return;
    const match = urlOrPath.match(/(tryon_\d+__[a-f0-9-]+\.[a-z0-9]+)/i);
    if (!match) return;
    const filename = match[1];
    try {
      await api(`/tryon/temp/${filename}`, { method: "DELETE" });
    } catch {
      // Best-effort non-blocking cleanup
    }
  }
};
