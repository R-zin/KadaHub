import { formatCurrency } from "../utils/format";

export const PriceDisplay = ({ price, originalPrice, discount }: { price: number; originalPrice?: number; discount?: number }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-lg font-bold text-slate-950">{formatCurrency(price)}</span>
    {originalPrice && <span className="text-sm text-slate-400 line-through">{formatCurrency(originalPrice)}</span>}
    {discount && <span className="text-xs font-semibold text-emerald-700">{discount}% off</span>}
  </div>
);
