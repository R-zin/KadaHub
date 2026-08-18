import type { Notification } from "../types";

export const notificationService = {
  create(message: string): Notification {
    return {
      id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      createdAt: new Date().toISOString(),
      read: false
    };
  }
};
