import type { Product, TryOnResult } from "../types";
import { api } from "./api";

export const canUseVirtualTryOn = (product?: Product) =>
  Boolean(product && product.category === "Clothing" && product.isVirtualTryOnSupported);

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
    api<{ result: TryOnResult }>("/tryon/generate", { method: "POST", body: { productId, sourceImage, size, color } }).then((d) => d.result),
  getSaved: () => api<{ results: TryOnResult[] }>("/tryon").then((d) => d.results)
};
