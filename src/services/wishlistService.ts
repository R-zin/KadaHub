import { api } from "./api";

export const wishlistService = {
  getIds: () => api<{ wishlist: string[] }>("/wishlist").then((d) => d.wishlist),
  toggle: (productId: string) => api<{ wishlist: string[] }>(`/wishlist/toggle/${productId}`, { method: "POST" }).then((d) => d.wishlist)
};
