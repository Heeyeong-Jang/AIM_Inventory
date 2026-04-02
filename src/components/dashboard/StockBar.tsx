import { cn } from "@/lib/utils";

interface StockBarProps {
  percentage: number;
}

function getBarColor(pct: number) {
  if (pct >= 100) return "bg-status-normal";
  if (pct >= 60) return "bg-status-comfortable";
  if (pct >= 40) return "bg-status-warning";
  return "bg-status-danger";
}

export function StockBar({ percentage }: StockBarProps) {
  const capped = Math.min(percentage, 100);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(percentage))}
          style={{ width: `${capped}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(percentage)}%</span>
    </div>
  );
}
