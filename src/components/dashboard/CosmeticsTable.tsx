import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockBar } from "./StockBar";
import { StockStatusBadge } from "./StockStatusBadge";
import type { SkuWithInventory } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

interface CosmeticsTableProps {
  skus: SkuWithInventory[];
  highlightSkuId?: string | null;
}

export function CosmeticsTable({ skus }: CosmeticsTableProps) {
  const cosmetics = skus.filter((s) => s.category === "cosmetics");

  const sixtyDays = new Date();
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  if (cosmetics.length === 0) {
    return <p className="text-muted-foreground text-center py-12">등록된 화장품 SKU가 없습니다.</p>;
  }

  return (
    <div className="rounded-lg border bg-card overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">제품명</TableHead>
            <TableHead className="font-semibold">카테고리</TableHead>
            <TableHead className="font-semibold text-right">현재 수량</TableHead>
            <TableHead className="font-semibold text-right">안전 재고</TableHead>
            <TableHead className="font-semibold">재고 비율</TableHead>
            <TableHead className="font-semibold">유통기한</TableHead>
            <TableHead className="font-semibold">로트 번호</TableHead>
            <TableHead className="font-semibold">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cosmetics.map((sku) => {
            const totalQty = sku.inventory.reduce((s, i) => s + (i.quantity ?? 0), 0);
            const pct = sku.safety_stock > 0 ? (totalQty / sku.safety_stock) * 100 : totalQty > 0 ? 100 : 0;
            const firstInv = sku.inventory[0];
            const expiresAt = firstInv?.expires_at;
            const isExpiringSoon = expiresAt && new Date(expiresAt) <= sixtyDays;

            return (
              <TableRow key={sku.id}>
                <TableCell className="font-medium">
                  {sku.name}
                  {sku.volume && <span className="text-muted-foreground ml-1 text-xs">({sku.volume})</span>}
                </TableCell>
                <TableCell>화장품</TableCell>
                <TableCell className="text-right tabular-nums">{totalQty.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{sku.safety_stock.toLocaleString()}</TableCell>
                <TableCell><StockBar percentage={pct} /></TableCell>
                <TableCell className={cn(isExpiringSoon && "text-destructive font-medium")}>
                  {expiresAt ?? "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">{firstInv?.lot_number ?? "-"}</TableCell>
                <TableCell><StockStatusBadge percentage={pct} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
