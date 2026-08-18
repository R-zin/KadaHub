import type { Product, TryOnResult } from "../types";

export const canUseVirtualTryOn = (product?: Product) =>
  Boolean(product && product.category === "Clothing" && product.isVirtualTryOnSupported);

export const tryOnService = {
  generatePreview: async (product: Product, sourceImage: string, size: string, color: string): Promise<TryOnResult> => {
    if (!canUseVirtualTryOn(product)) {
      throw new Error("Virtual Try-On is available only for supported clothing products.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      id: `tryon-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      sourceImage,
      previewImage: product.images[0],
      size,
      color,
      createdAt: new Date().toISOString()
    };
  }
};
