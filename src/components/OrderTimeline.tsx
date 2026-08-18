import { CheckCircle2, Circle } from "lucide-react";
import { orderTimeline } from "../services/orderService";
import type { OrderStatus } from "../types";

export const OrderTimeline = ({ status }: { status: OrderStatus }) => {
  const activeIndex = orderTimeline.indexOf(status);
  return (
    <div className="space-y-3">
      {orderTimeline.map((step, index) => {
        const complete = index <= activeIndex;
        return (
          <div key={step} className="flex items-center gap-3">
            {complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-slate-300" />}
            <span className={complete ? "font-semibold text-slate-950" : "text-slate-500"}>{step}</span>
          </div>
        );
      })}
    </div>
  );
};
