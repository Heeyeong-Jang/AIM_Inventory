import { cn } from "@/lib/utils";

interface StockStatusBadgeProps {
  percentage: number;
}

function getStatus(pct: number) {
  if (pct >= 100) return { label: "정상", className: "bg-status-normal/15 text-status-normal-fg border-status-normal/30" };
  if (pct >= 60) return { label: "여유", className: "bg-status-comfortable/15 text-status-comfortable-fg border-status-comfortable/30" };
  if (pct >= 40) return { label: "주의", className: "bg-status-warning/15 text-status-warning-fg border-status-warning/30" };
  return { label: "부족", className: "bg-status-danger/15 text-status-danger-fg border-status-danger/30" };
}

export function StockStatusBadge({ percentage }: StockStatusBadgeProps) {
  const status = getStatus(percentage);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", status.className)}>
      {status.label}
    </span>
  );
}
