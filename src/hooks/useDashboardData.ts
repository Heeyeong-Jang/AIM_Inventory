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
  });

  const skus = skusQuery.data ?? [];
  const totalSkus = skus.length;

  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  let lowStockCount = 0;
  let expiringSoonCount = 0;

  skus.forEach((sku) => {
    const totalQty = sku.inventory.reduce((sum, inv) => sum + (inv.quantity ?? 0), 0);
    if (totalQty < sku.safety_stock) lowStockCount++;
    sku.inventory.forEach((inv) => {
      if (inv.expires_at && new Date(inv.expires_at) <= sixtyDaysFromNow) {
        expiringSoonCount++;
      }
    });
  });

  return {
    skus,
    totalSkus,
    lowStockCount,
    expiringSoonCount,
    inboundThisMonth: inboundQuery.data ?? 0,
    isLoading: skusQuery.isLoading || inboundQuery.isLoading,
  };
}
