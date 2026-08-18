import type { Role, User } from "../types";

export const demoAccounts: User[] = [
  { id: "u-customer", name: "Maya Customer", email: "customer@demo.com", role: "customer" },
  { id: "u-seller", name: "Sam Seller", email: "seller@demo.com", role: "seller" },
  { id: "u-delivery", name: "Dev Delivery", email: "delivery@demo.com", role: "delivery" },
  { id: "u-admin", name: "Anika Admin", email: "admin@demo.com", role: "admin" }
];

export const authService = {
  loginAsRole: async (role: Role) => demoAccounts.find((account) => account.role === role) ?? demoAccounts[0],
  register: async (name: string, email: string, role: Role): Promise<User> => ({ id: `u-${Date.now()}`, name, email, role }),
  logout: async () => true
};
