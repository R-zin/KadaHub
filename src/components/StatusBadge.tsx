import { Badge } from "./ui";

export const StatusBadge = ({ status }: { status: string }) => {
  const tone = status.includes("Delivered") || status.includes("Paid") || status.includes("Approved") || status.includes("Refunded")
    ? "success"
    : status.includes("Failed") || status.includes("Rejected")
      ? "danger"
      : status.includes("Low") || status.includes("Pending") || status.includes("Requested")
        ? "warning"
        : "primary";
  return <Badge tone={tone}>{status}</Badge>;
};
