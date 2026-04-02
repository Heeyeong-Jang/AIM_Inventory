import { AlertTriangle, Clock, Truck } from "lucide-react";
import type { AlertItem } from "@/hooks/useDashboardData";

interface AlertBannerProps {
  alerts: AlertItem[];
  onAlertClick: (alert: AlertItem) => void;
}

export function AlertBanner({ alerts, onAlertClick }: AlertBannerProps) {
  const lowStock = alerts.filter((a) => a.type === "low_stock");
  const expiring = alerts.filter((a) => a.type === "expiring");
  const overdue = alerts.filter((a) => a.type === "overdue");

  if (lowStock.length === 0 && expiring.length === 0 && overdue.length === 0) return null;

  return (
    <div className="space-y-2">
      {lowStock.length > 0 && (
        <button
          type="button"
          onClick={() => onAlertClick(lowStock[0])}
          className="w-full flex items-center gap-3 rounded-lg border border-status-danger/30 bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger-fg transition-colors hover:bg-status-danger/20 text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">재고 부족 {lowStock.length}건</span>
          <span className="text-xs opacity-75 truncate">
            {lowStock.slice(0, 3).map((a) => a.skuName).join(", ")}
            {lowStock.length > 3 && ` 외 ${lowStock.length - 3}건`}
          </span>
        </button>
      )}
      {expiring.length > 0 && (
        <button
          type="button"
          onClick={() => onAlertClick(expiring[0])}
          className="w-full flex items-center gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-sm text-status-warning-fg transition-colors hover:bg-status-warning/20 text-left"
        >
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium">유통기한 임박 {expiring.length}건</span>
          <span className="text-xs opacity-75 truncate">
            {expiring.slice(0, 3).map((a) => a.skuName).join(", ")}
            {expiring.length > 3 && ` 외 ${expiring.length - 3}건`}
          </span>
        </button>
      )}
      {overdue.length > 0 && (
        <button
          type="button"
          onClick={() => onAlertClick(overdue[0])}
          className="w-full flex items-center gap-3 rounded-lg border border-status-warning/30 bg-[hsl(25_95%_53%/0.1)] px-4 py-2.5 text-sm text-[hsl(25_95%_35%)] transition-colors hover:bg-[hsl(25_95%_53%/0.2)] text-left"
        >
          <Truck className="h-4 w-4 shrink-0" />
          <span className="font-medium">입고 지연 {overdue.length}건</span>
          <span className="text-xs opacity-75 truncate">
            {overdue.slice(0, 3).map((a) => a.skuName).join(", ")}
            {overdue.length > 3 && ` 외 ${overdue.length - 3}건`}
          </span>
        </button>
      )}
    </div>
  );
}
