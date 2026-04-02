import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, Clock, Truck } from "lucide-react";

interface MetricsRowProps {
  totalSkus: number;
  lowStockCount: number;
  expiringSoonCount: number;
  inboundThisMonth: number;
}

const metrics = [
  { key: "total", label: "전체 활성 SKU", icon: Package, color: "text-primary" },
  { key: "low", label: "재고 부족 알림", icon: AlertTriangle, color: "text-status-danger" },
  { key: "expiring", label: "유통기한 임박", icon: Clock, color: "text-status-warning" },
  { key: "inbound", label: "이번 달 입고 예정", icon: Truck, color: "text-status-comfortable" },
] as const;

export function MetricsRow({ totalSkus, lowStockCount, expiringSoonCount, inboundThisMonth }: MetricsRowProps) {
  const values: Record<string, number> = {
    total: totalSkus,
    low: lowStockCount,
    expiring: expiringSoonCount,
    inbound: inboundThisMonth,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <Card key={m.key} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-muted ${m.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold tracking-tight">{values[m.key]}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
