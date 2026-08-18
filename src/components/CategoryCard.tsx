import { BookOpen, Dumbbell, Home, Puzzle, Shirt, ShoppingBasket, Smartphone, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import type { Category } from "../types";

const icons = {
  smartphone: Smartphone,
  shirt: Shirt,
  home: Home,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  "book-open": BookOpen,
  "shopping-basket": ShoppingBasket,
  puzzle: Puzzle
};

export const CategoryCard = ({ category }: { category: Category }) => {
  const Icon = icons[category.icon as keyof typeof icons] ?? ShoppingBasket;
  return (
    <Link to={`/category/${category.slug}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="aspect-[5/3] overflow-hidden bg-slate-100">
        <img src={category.image} alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-primary-50 p-2 text-primary-700"><Icon className="h-5 w-5" /></span>
          <h3 className="font-semibold text-slate-950">{category.name}</h3>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{category.description}</p>
      </div>
    </Link>
  );
};
