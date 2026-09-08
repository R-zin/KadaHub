import type { Notification } from "../types";
import { api } from "./api";

export const notificationService = {
  getAll: () => api<{ notifications: Notification[] }>("/notifications").then((d) => d.notifications),
  markAllRead: () => api<{ notifications: Notification[] }>("/notifications/read-all", { method: "POST" }).then((d) => d.notifications),
  dismiss: (id: string) => api<{ notifications: Notification[] }>(`/notifications/${id}`, { method: "DELETE" }).then((d) => d.notifications)
};
