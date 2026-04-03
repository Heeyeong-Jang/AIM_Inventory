import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABELS: Record<string, string> = {
  pending: "대기중",
  in_transit: "운송중",
  confirmed: "확인완료",
  received: "입고완료",
};

export function RecentOrdersTable() {
  const inboundQuery = useQuery({
    queryKey: ["recent-inbound-5"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_orders")
        .select("id, quantity, supplier, status, expected_at, created_at, skus(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const outboundQuery = useQuery({
    queryKey: ["recent-outbound-5"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_logs")
        .select("id, quantity, destination, channel, shipped_at, skus(name)")
        .order("shipped_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const inbound = inboundQuery.data ?? [];
  const outbound = outboundQuery.data ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 입고 현황 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary" />
            최근 입고 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">제품명</TableHead>
                  <TableHead className="text-xs font-semibold text-right">수량</TableHead>
                  <TableHead className="text-xs font-semibold">공급사</TableHead>
                  <TableHead className="text-xs font-semibold">상태</TableHead>
                  <TableHead className="text-xs font-semibold">등록일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbound.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                      입고 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  inbound.map((row) => {
                    const skuInfo = row.skus as { name: string } | null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm font-medium">{skuInfo?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{row.quantity?.toLocaleString() ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.supplier ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_LABELS[row.status ?? "pending"] ?? row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.created_at ? format(new Date(row.created_at), "MM/dd HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 출고 현황 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4 text-primary" />
            최근 출고 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">제품명</TableHead>
                  <TableHead className="text-xs font-semibold text-right">수량</TableHead>
                  <TableHead className="text-xs font-semibold">납품처</TableHead>
                  <TableHead className="text-xs font-semibold">채널</TableHead>
                  <TableHead className="text-xs font-semibold">출고일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outbound.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                      출고 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  outbound.map((row) => {
                    const skuInfo = row.skus as { name: string } | null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm font-medium">{skuInfo?.name ?? "-"}</TableCell>
                        <TableCell className="text-sm text-right tabular-nums">{row.quantity?.toLocaleString() ?? 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.destination ?? "-"}</TableCell>
                        <TableCell>
                          {row.channel && <Badge variant="outline" className="text-[10px]">{row.channel}</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.shipped_at ? format(new Date(row.shipped_at), "MM/dd") : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
