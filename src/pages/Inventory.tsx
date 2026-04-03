import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StockBar } from "@/components/dashboard/StockBar";
import { StockStatusBadge } from "@/components/dashboard/StockStatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "대기중",
  in_transit: "운송중",
  confirmed: "확인완료",
  received: "입고완료",
};

function SkuDetailPanel({ skuId }: { skuId: string }) {
  const queryClient = useQueryClient();

  async function handleStatusChange(orderId: string, newStatus: string, oldStatus: string, orderQuantity: number) {
    const { error } = await supabase
      .from("inbound_orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error("상태 변경 실패: " + error.message);
      return;
    }

    // "received"로 변경 시 재고 추가, "received"에서 다른 상태로 변경 시 재고 차감
    const wasReceived = oldStatus === "received";
    const isNowReceived = newStatus === "received";

    if (!wasReceived && isNowReceived) {
      // 재고 추가
      const { data: existing } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("sku_id", skuId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("inventory")
          .update({ quantity: (existing.quantity ?? 0) + orderQuantity, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("inventory").insert({
          sku_id: skuId,
          quantity: orderQuantity,
          lot_number: `AUTO-${orderId.slice(0, 8)}`,
        });
      }
    } else if (wasReceived && !isNowReceived) {
      // 재고 차감
      const { data: existing } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("sku_id", skuId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const newQty = Math.max((existing.quantity ?? 0) - orderQuantity, 0);
        await supabase
          .from("inventory")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
    }

    toast.success("상태가 변경되었습니다.");
    queryClient.invalidateQueries({ queryKey: ["sku-inbound-history", skuId] });
    queryClient.invalidateQueries({ queryKey: ["sku-inventory-detail", skuId] });
    queryClient.invalidateQueries({ queryKey: ["skus-with-inventory"] });
    queryClient.invalidateQueries({ queryKey: ["recent-inbound-5"] });
    queryClient.invalidateQueries({ queryKey: ["inbound-this-month"] });
    queryClient.invalidateQueries({ queryKey: ["overdue-inbound"] });
  }
  const inboundQuery = useQuery({
    queryKey: ["sku-inbound-history", skuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_orders")
        .select("id, quantity, supplier, status, expected_at, created_at")
        .eq("sku_id", skuId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const outboundQuery = useQuery({
    queryKey: ["sku-outbound-history", skuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_logs")
        .select("id, quantity, destination, channel, shipped_at, lot_number")
        .eq("sku_id", skuId)
        .order("shipped_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const inventoryQuery = useQuery({
    queryKey: ["sku-inventory-detail", skuId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, quantity, lot_number, expires_at, updated_at")
        .eq("sku_id", skuId)
        .order("expires_at");
      if (error) throw error;
      return data;
    },
  });

  const inbound = inboundQuery.data ?? [];
  const outbound = outboundQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];

  return (
    <div className="px-6 py-4 bg-muted/30 border-t space-y-4">
      {/* 재고 현황 */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">📦 재고 현황 (로트별)</h4>
        {inventory.length === 0 ? (
          <p className="text-xs text-muted-foreground">재고 데이터 없음</p>
        ) : (
          <div className="rounded-md border bg-card overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">로트번호</TableHead>
                  <TableHead className="text-xs text-right">수량</TableHead>
                  <TableHead className="text-xs">유통기한</TableHead>
                  <TableHead className="text-xs">최종 수정</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-xs">{inv.lot_number ?? "-"}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{(inv.quantity ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{inv.expires_at ?? "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.updated_at ? format(new Date(inv.updated_at), "MM/dd HH:mm") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 입고 이력 */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <ArrowDownToLine className="h-3.5 w-3.5 text-primary" /> 입고 이력
          </h4>
          {inbound.length === 0 ? (
            <p className="text-xs text-muted-foreground">입고 내역 없음</p>
          ) : (
            <div className="rounded-md border bg-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">등록일</TableHead>
                    <TableHead className="text-xs text-right">수량</TableHead>
                    <TableHead className="text-xs">공급사</TableHead>
                    <TableHead className="text-xs">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inbound.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {row.created_at ? format(new Date(row.created_at), "MM/dd") : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{(row.quantity ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.supplier ?? "-"}</TableCell>
                      <TableCell>
                        <Select
                          value={row.status ?? "pending"}
                          onValueChange={(val) => handleStatusChange(row.id, val, row.status ?? "pending", row.quantity ?? 0)}
                        >
                          <SelectTrigger className="h-7 text-[10px] w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* 출고 이력 */}
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <ArrowUpFromLine className="h-3.5 w-3.5 text-primary" /> 출고 이력
          </h4>
          {outbound.length === 0 ? (
            <p className="text-xs text-muted-foreground">출고 내역 없음</p>
          ) : (
            <div className="rounded-md border bg-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">출고일</TableHead>
                    <TableHead className="text-xs text-right">수량</TableHead>
                    <TableHead className="text-xs">납품처</TableHead>
                    <TableHead className="text-xs">채널</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outbound.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">
                        {row.shipped_at ? format(new Date(row.shipped_at), "MM/dd") : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{(row.quantity ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.destination ?? "-"}</TableCell>
                      <TableCell>
                        {row.channel && <Badge variant="outline" className="text-[10px]">{row.channel}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Inventory = () => {
  const { skus, isLoading } = useDashboardData();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sixtyDays = new Date();
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">제품명을 클릭하면 상세 입/출고 이력을 확인할 수 있습니다.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">데이터를 불러오는 중...</div>
      ) : skus.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">등록된 SKU가 없습니다.</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8" />
                <TableHead className="font-semibold">제품명</TableHead>
                <TableHead className="font-semibold">카테고리</TableHead>
                <TableHead className="font-semibold text-right">총 수량</TableHead>
                <TableHead className="font-semibold text-right">안전 재고</TableHead>
                <TableHead className="font-semibold">재고 비율</TableHead>
                <TableHead className="font-semibold">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {skus.map((sku) => {
                const totalQty = sku.inventory.reduce((s, i) => s + (i.quantity ?? 0), 0);
                const pct = sku.safety_stock > 0 ? (totalQty / sku.safety_stock) * 100 : totalQty > 0 ? 100 : 0;
                const isOpen = expandedId === sku.id;

                return (
                  <Collapsible key={sku.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : sku.id)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="w-8 px-2">
                            <ChevronRight className={cn("h-4 w-4 transition-transform text-muted-foreground", isOpen && "rotate-90")} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {sku.name}
                            {sku.volume && <span className="text-muted-foreground ml-1 text-xs">({sku.volume})</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {sku.category === "medical" ? "의료기기" : "화장품"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{totalQty.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{sku.safety_stock.toLocaleString()}</TableCell>
                          <TableCell><StockBar percentage={pct} /></TableCell>
                          <TableCell><StockStatusBadge percentage={pct} /></TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={7} className="p-0">
                            <SkuDetailPanel skuId={sku.id} />
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Inventory;
