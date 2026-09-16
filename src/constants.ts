import type { Address } from "./types";

export const defaultAddress: Address = {
  name: "Maya Customer",
  phone: "+1 555 0188",
  line1: "42 Market Street",
  city: "San Francisco",
  region: "CA",
  postalCode: "94105"
};

export const SUGGESTED_PRODUCT_TYPES: Record<string, string[]> = {
  // Electronics
  Smartphones: ["Smartphone", "Foldable Phone", "Gaming Phone"],
  Laptops: ["Laptop", "Ultrabook", "Gaming Laptop", "2-in-1 Laptop"],
  Headphones: ["Headphones", "Earbuds", "In-Ear Monitors"],
  "Smart Watches": ["Smart Watch", "Fitness Tracker", "Sport Watch"],
  Cameras: ["Mirrorless Camera", "Action Camera", "DSLR", "Point & Shoot"],
  "Home Audio": ["Speaker", "Soundbar", "Subwoofer", "Home Theater"],
  Accessories: ["Dock", "Monitor", "Charger", "Keyboard", "Mouse", "Power Bank"],

  // Clothing
  "T-Shirts": ["T-Shirt", "Graphic Tee", "Polo Shirt", "Tank Top"],
  Shirts: ["Shirt", "Formal Shirt", "Casual Shirt", "Flannel Shirt"],
  Jeans: ["Jeans", "Slim Fit Jeans", "Relaxed Fit Jeans", "Distressed Jeans"],
  Dresses: ["Dress", "Midi Dress", "Maxi Dress", "Evening Gown"],
  Jackets: ["Jacket", "Denim Jacket", "Winter Coat", "Bomber Jacket"],
  Footwear: ["Shoes", "Sneakers", "Running Shoes", "Boots"],
  Activewear: ["Activewear", "Track Pants", "Gym T-Shirt", "Leggings"],
  "Kids Clothing": ["Kids T-Shirt", "Kids Hoodie", "Kids Set"],
  Hoodies: ["Hoodie", "Zip-Up Hoodie", "Oversized Hoodie", "Sweatshirt"],

  // Home & Living
  Furniture: ["Study Table", "Chair", "Desk", "Sofa", "Coffee Table"],
  Kitchenware: ["Coffee Maker", "Dinner Set", "Cookware", "Blender", "Cutlery"],
  "Home Decor": ["Rug", "Cushion Set", "Wall Clock", "Vase", "Wall Art"],
  Lighting: ["Table Lamp", "Bedside Lamp", "Floor Lamp", "Ceiling Light"],
  Storage: ["Bookshelf", "Storage", "Organizer", "Shoe Rack"],
  Bedding: ["Bedsheet Set", "Pillow", "Duvet Cover", "Blanket"],

  // Beauty
  Skincare: ["Face Wash", "Moisturizer", "Serum", "Sunscreen", "Toner"],
  Makeup: ["Lipstick", "Foundation", "Mascara", "Eyeshadow", "Blush"],
  "Hair Care": ["Shampoo", "Conditioner", "Hair Dryer", "Hair Oil"],
  "Personal Care": ["Body Lotion", "Lip Balm", "Body Wash", "Deodorant"],
  Fragrance: ["Perfume", "Eau De Parfum", "Body Mist", "Cologne"],

  // Sports
  Sportswear: ["Running Shoes", "Sports T-Shirt", "Activewear", "Track Pants"],
  "Fitness Equipment": ["Yoga Mat", "Dumbbells", "Resistance Bands", "Gym Gloves"],
  "Outdoor Gear": ["Water Bottle", "Backpack", "Tent", "Flashlight"],
  "Team Sports": ["Football", "Basketball", "Cricket Bat", "Volleyball"],

  // Books
  Fiction: ["Novel", "Thriller", "Sci-Fi", "Fantasy", "Mystery"],
  "Non-Fiction": ["Biography", "History Book", "Self Help", "Business"],
  Programming: ["Programming Book", "Technical Manual", "Reference Guide"],
  "Science & Tech": ["Textbook", "Science Journal", "Research Guide"],
  "School Supplies": ["Notebook", "Planner", "Folder", "Binder"],
  Stationery: ["Organizer", "Art Supplies", "Pens", "Markers"],

  // Grocery
  "Food & Snacks": ["Oats", "Nuts", "Snacks", "Biscuits", "Cereal"],
  Beverages: ["Coffee", "Tea", "Drink", "Juice", "Water"],
  "Household Essentials": ["Dish Soap", "Detergent", "Surface Cleaner", "Tissues"],
  "Pantry Staples": ["Rice", "Olive Oil", "Flour", "Pasta", "Spices"],
  Organic: ["Honey", "Grain", "Organic Superfood"],

  // Toys & More
  "Toys & Games": ["Building Blocks", "Robot", "Puzzle", "RC Car", "Board Game"],
  Gadgets: ["Drone", "Projector", "Smart Gadget"],
  "Pet Supplies": ["Pet Bed", "Pet Feeder", "Pet Toy", "Collar"],
  "Travel Accessories": ["Scale", "Travel Pillow", "Passport Holder", "Luggage Tag"],
  "General Products": ["Gift Wrap", "Multi-tool", "Keychain", "Umbrella"]
};

export const getSuggestedProductTypes = (subcategory: string): string[] => {
  return SUGGESTED_PRODUCT_TYPES[subcategory] || (subcategory ? [subcategory] : []);
};

export const COMMON_SPEC_KEYS = [
  "Material",
  "Colour",
  "Size",
  "Weight",
  "Dimensions",
  "Warranty",
  "Storage",
  "RAM",
  "Battery",
  "Capacity"
];
