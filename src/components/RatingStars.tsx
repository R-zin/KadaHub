import { Star } from "lucide-react";

export const RatingStars = ({ rating, count }: { rating: number; count?: number }) => (
  <div className="flex items-center gap-1 text-sm">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} className={`h-4 w-4 ${star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
    ))}
    <span className="ml-1 text-slate-600">{rating.toFixed(1)}{count ? ` (${count})` : ""}</span>
  </div>
);
