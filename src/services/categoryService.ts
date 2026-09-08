import type { Category } from "../types";
import { api } from "./api";

export const categoryService = {
  getCategories: () => api<{ categories: Category[] }>("/categories").then((d) => d.categories)
};
