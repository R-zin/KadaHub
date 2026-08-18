import type { Category } from "../types";

export const categories: Category[] = [
  {
    id: "cat-electronics",
    name: "Electronics",
    slug: "electronics",
    subcategories: ["Smartphones", "Laptops", "Headphones", "Cameras", "Smart Watches", "Accessories"],
    description: "Devices, gadgets, and everyday tech essentials.",
    icon: "smartphone",
    image: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-clothing",
    name: "Clothing",
    slug: "clothing",
    subcategories: ["Men's", "Women's", "Kids", "Shirts", "T-Shirts", "Dresses", "Jackets", "Jeans"],
    description: "Everyday fashion with try-on support for selected items.",
    icon: "shirt",
    image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-home",
    name: "Home & Living",
    slug: "home",
    subcategories: ["Furniture", "Kitchen", "Home Decor", "Lighting", "Storage"],
    description: "Furniture, kitchenware, decor, lighting, and storage.",
    icon: "home",
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-beauty",
    name: "Beauty",
    slug: "beauty",
    subcategories: ["Skincare", "Makeup", "Hair Care", "Personal Care"],
    description: "Personal care products for daily routines.",
    icon: "sparkles",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-sports",
    name: "Sports",
    slug: "sports",
    subcategories: ["Sportswear", "Fitness Equipment", "Outdoor Gear"],
    description: "Gear for workouts, sports, and active weekends.",
    icon: "dumbbell",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-books",
    name: "Books",
    slug: "books",
    subcategories: ["Books", "School Supplies", "Office Supplies"],
    description: "Reading, learning, and stationery for school or work.",
    icon: "book-open",
    image: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-grocery",
    name: "Grocery",
    slug: "grocery",
    subcategories: ["Food", "Beverages", "Household Essentials"],
    description: "Pantry staples, drinks, and home essentials.",
    icon: "shopping-basket",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80"
  },
  {
    id: "cat-toys",
    name: "Toys & More",
    slug: "toys",
    subcategories: ["Toys", "Gadgets", "Pet Supplies", "General Products"],
    description: "Gifts, play, gadgets, pet items, and useful extras.",
    icon: "puzzle",
    image: "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80"
  }
];
