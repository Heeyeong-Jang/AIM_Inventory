import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SkuWithInventory {
  id: string;
  name: string;
  category: string | null;
  volume: string | null;
  safety_stock: number;
  unit_price: number;
  supplier: string | null;
  inventory: {
    quantity: number;
    lot_number: string | null;
    expires_at: string | null;
  }[];
}

export interface AlertItem {
  type: "low_stock" | "expiring" | "overdue";
  skuId: string;
  skuName: string;
  category: string | null;
}

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useDashboardData() {
  const skusQuery = useQuery({
    queryKey: ["skus-with-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skus")
        .select("*, inventory(quantity, lot_number, expires_at)")
        .order("name");
      if (error) throw error;
      return (data as unknown as SkuWithInventory[]).map((s) => ({
        ...s,
        safety_stock: s.safety_stock ?? 0,
        unit_price: s.unit_price ?? 0,
        inventory: s.inventory ?? [],
      }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const inboundQuery = useQuery({
    queryKey: ["inbound-this-month"],
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const { count, error } = await supabase
        .from("inbound_orders")
        .select("*", { count: "exact", head: true })
        .gte("expected_at", start)
        .lte("expected_at", end);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const overdueQuery = useQuery({
    queryKey: ["overdue-inbound"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("inbound_orders")
        .select("id, sku_id, skus(name, category)")
        .lt("expected_at", today)
        .neq("status", "received");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const skus = skusQuery.data ?? [];
  const totalSkus = skus.length;

  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  let lowStockCount = 0;
  let expiringSoonCount = 0;
  const alerts: AlertItem[] = [];

  skus.forEach((sku) => {
    const totalQty = sku.inventory.reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
    if (totalQty < sku.safety_stock) {
      lowStockCount++;
      alerts.push({ type: "low_stock", skuId: sku.id, skuName: sku.name, category: sku.category });
    }
    sku.inventory.forEach((inv) => {
      if (inv.expires_at && new Date(inv.expires_at) <= sixtyDaysFromNow) {
        expiringSoonCount++;
        alerts.push({ type: "expiring", skuId: sku.id, skuName: sku.name, category: sku.category });
      }
    });
  });

  const overdueOrders = overdueQuery.data ?? [];
  overdueOrders.forEach((order) => {
    const skuInfo = order.skus as { name: string; category: string | null } | null;
    alerts.push({
      type: "overdue",
      skuId: order.sku_id ?? "",
      skuName: skuInfo?.name ?? "알 수 없음",
      category: skuInfo?.category ?? null,
    });
  });

  return {
    skus,
    totalSkus,
    lowStockCount,
    expiringSoonCount,
    overdueCount: overdueOrders.length,
    inboundThisMonth: inboundQuery.data ?? 0,
    alerts,
    totalAlertCount: lowStockCount + expiringSoonCount + overdueOrders.length,
    isLoading: skusQuery.isLoading || inboundQuery.isLoading,
  };
}
