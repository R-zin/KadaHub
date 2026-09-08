import type { ReturnRequest } from "../types";
import { api } from "./api";

export const returnService = {
  request: (orderId: string, productId: string, reason: string) =>
    api<{ return: ReturnRequest }>("/returns", { method: "POST", body: { orderId, productId, reason } }).then((d) => d.return),
  getReturns: () => api<{ returns: ReturnRequest[] }>("/returns").then((d) => d.returns),
  approve: (id: string) => api<{ return: ReturnRequest }>(`/returns/${id}/approve`, { method: "POST" }).then((d) => d.return),
  reject: (id: string) => api<{ return: ReturnRequest }>(`/returns/${id}/reject`, { method: "POST" }).then((d) => d.return)
};
