import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockBar } from "./StockBar";
import { StockStatusBadge } from "./StockStatusBadge";
import type { SkuWithInventory } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

interface MedicalTableProps {
  skus: SkuWithInventory[];
}

function GradeBadge({ grade }: { grade: string }) {
  const is1 = grade === "1등급";
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
      is1 ? "bg-muted text-muted-foreground border-border" : "bg-status-comfortable/15 text-status-comfortable-fg border-status-comfortable/30"
    )}>
      {grade}
    </span>
  );
}

export function MedicalTable({ skus }: MedicalTableProps) {
  const medical = skus.filter((s) => s.category === "medical");

  const sixtyDays = new Date();
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  if (medical.length === 0) {
    return <p className="text-muted-foreground text-center py-12">등록된 의료기기 SKU가 없습니다.</p>;
  }

  return (
    <div className="rounded-lg border bg-card overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">제품명</TableHead>
            <TableHead className="font-semibold">등급</TableHead>
            <TableHead className="font-semibold">인증번호</TableHead>
            <TableHead className="font-semibold text-right">현재 수량</TableHead>
            <TableHead className="font-semibold">유통기한</TableHead>
            <TableHead className="font-semibold">재고 비율</TableHead>
            <TableHead className="font-semibold">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {medical.map((sku) => {
            const totalQty = sku.inventory.reduce((s, i) => s + (i.quantity ?? 0), 0);
            const pct = sku.safety_stock > 0 ? (totalQty / sku.safety_stock) * 100 : totalQty > 0 ? 100 : 0;
            const firstInv = sku.inventory[0];
            const expiresAt = firstInv?.expires_at;
            const isExpiringSoon = expiresAt && new Date(expiresAt) <= sixtyDays;
            // Derive grade from volume field as placeholder (e.g. "1등급", "2등급")
            const grade = sku.volume?.includes("2") ? "2등급" : "1등급";

            return (
              <TableRow key={sku.id}>
                <TableCell className="font-medium">{sku.name}</TableCell>
                <TableCell><GradeBadge grade={grade} /></TableCell>
                <TableCell className="text-muted-foreground">{firstInv?.lot_number ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{totalQty.toLocaleString()}</TableCell>
                <TableCell className={cn(isExpiringSoon && "text-destructive font-medium")}>
                  {expiresAt ?? "-"}
                </TableCell>
                <TableCell><StockBar percentage={pct} /></TableCell>
                <TableCell><StockStatusBadge percentage={pct} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
