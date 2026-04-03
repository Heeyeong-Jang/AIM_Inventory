import { useState, useMemo } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const STATUS_MAP: Record<string, { label: string; db: string }> = {
  pending: { label: "대기중", db: "pending" },
  in_transit: { label: "운송중", db: "in_transit" },
  confirmed: { label: "확인완료", db: "confirmed" },
  received: { label: "입고완료", db: "received" },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_transit: "bg-status-warning/15 text-status-warning-fg border-status-warning/30",
  confirmed: "bg-status-comfortable/15 text-status-comfortable-fg border-status-comfortable/30",
  received: "bg-status-normal/15 text-status-normal-fg border-status-normal/30",
};

const inboundSchema = z.object({
  sku_id: z.string().uuid("SKU를 선택해 주세요"),
  quantity: z.number().int().min(1, "수량은 1 이상이어야 합니다"),
  lot_number: z.string().trim().min(1, "로트번호를 입력해 주세요").max(100),
  expires_at: z.string().min(1, "유통기한을 입력해 주세요"),
  supplier: z.string().max(200).optional(),
  expected_at: z.string().optional(),
  status: z.string().default("pending"),
});

interface InboundFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboundFormSheet({ open, onOpenChange }: InboundFormSheetProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skuPopoverOpen, setSkuPopoverOpen] = useState(false);

  const [skuId, setSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [lotNumber, setLotNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [status, setStatus] = useState("pending");

  const skusQuery = useQuery({
    queryKey: ["skus-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("skus").select("id, name, volume, supplier").order("name");
      if (error) throw error;
      return data;
    },
  });

  const recentOrdersQuery = useQuery({
    queryKey: ["recent-inbound-orders"],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("inbound_orders")
        .select("*, skus(name, volume)")
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const skus = skusQuery.data ?? [];
  const selectedSku = useMemo(() => skus.find((s) => s.id === skuId), [skus, skuId]);

  function handleSkuSelect(id: string) {
    setSkuId(id);
    setSkuPopoverOpen(false);
    const sku = skus.find((s) => s.id === id);
    if (sku?.supplier) setSupplier(sku.supplier);
  }

  function resetForm() {
    setSkuId(""); setQuantity(1); setLotNumber(""); setExpiresAt("");
    setSupplier(""); setExpectedAt(""); setStatus("pending"); setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = inboundSchema.safeParse({
      sku_id: skuId || undefined,
      quantity,
      lot_number: lotNumber,
      expires_at: expiresAt,
      supplier: supplier || undefined,
      expected_at: expectedAt || undefined,
      status,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);

    // 1. Insert inbound order
    const { error: orderError } = await supabase.from("inbound_orders").insert({
      sku_id: parsed.data.sku_id,
      quantity: parsed.data.quantity,
      supplier: parsed.data.supplier ?? null,
      expected_at: parsed.data.expected_at || null,
      status: parsed.data.status,
    });

    if (orderError) {
      setSubmitting(false);
      toast.error("입고 등록에 실패했습니다: " + orderError.message);
      return;
    }

    // 2. If received, update inventory
    if (parsed.data.status === "received") {
      const { data: existing, error: fetchError } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("sku_id", parsed.data.sku_id)
        .eq("lot_number", parsed.data.lot_number)
        .maybeSingle();

      if (fetchError) {
        console.error("inventory fetch error:", fetchError);
        toast.error("재고 조회 중 오류: " + fetchError.message);
      }

      let inventoryError: { message: string } | null = null;
      if (existing) {
        const { error } = await supabase
          .from("inventory")
          .update({
            quantity: (existing.quantity ?? 0) + parsed.data.quantity,
            expires_at: parsed.data.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        inventoryError = error;
      } else {
        const { error } = await supabase.from("inventory").insert({
          sku_id: parsed.data.sku_id,
          quantity: parsed.data.quantity,
          lot_number: parsed.data.lot_number,
          expires_at: parsed.data.expires_at,
        });
        inventoryError = error;
      }

      if (inventoryError) {
        console.error("inventory update error:", inventoryError);
        toast.error("재고 반영 중 오류: " + inventoryError.message);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    toast.success("입고가 성공적으로 등록되었습니다.");
    queryClient.invalidateQueries({ queryKey: ["skus-with-inventory"] });
    queryClient.invalidateQueries({ queryKey: ["inbound-this-month"] });
    queryClient.invalidateQueries({ queryKey: ["recent-inbound-orders"] });
    resetForm();
    onOpenChange(false);
  }

  const recentOrders = recentOrdersQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>입고 등록</SheetTitle>
          <SheetDescription>새로운 입고 정보를 등록합니다.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* SKU 선택 */}
          <div className="space-y-1.5">
            <Label>SKU 선택 <span className="text-destructive">*</span></Label>
            <Popover open={skuPopoverOpen} onOpenChange={setSkuPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedSku
                    ? `${selectedSku.name}${selectedSku.volume ? ` (${selectedSku.volume})` : ""}`
                    : "SKU를 검색하세요"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="제품명 검색..." />
                  <CommandList>
                    <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {skus.map((sku) => (
                        <CommandItem key={sku.id} value={`${sku.name} ${sku.volume ?? ""}`} onSelect={() => handleSkuSelect(sku.id)}>
                          <Check className={cn("mr-2 h-4 w-4", skuId === sku.id ? "opacity-100" : "opacity-0")} />
                          {sku.name}
                          {sku.volume && <span className="ml-1 text-muted-foreground text-xs">({sku.volume})</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.sku_id && <p className="text-xs text-destructive">{errors.sku_id}</p>}
          </div>

          {/* 입고 수량 & 로트번호 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inbound-qty">입고 수량 <span className="text-destructive">*</span></Label>
              <Input id="inbound-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inbound-lot">로트번호 <span className="text-destructive">*</span></Label>
              <Input id="inbound-lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="LOT-2024-001" />
              {errors.lot_number && <p className="text-xs text-destructive">{errors.lot_number}</p>}
            </div>
          </div>

          {/* 유통기한 & 입고 예정일 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inbound-expiry">유통기한 <span className="text-destructive">*</span></Label>
              <Input id="inbound-expiry" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              {errors.expires_at && <p className="text-xs text-destructive">{errors.expires_at}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inbound-expected">입고 예정일</Label>
              <Input id="inbound-expected" type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
            </div>
          </div>

          {/* 공급사 */}
          <div className="space-y-1.5">
            <Label htmlFor="inbound-supplier">공급사</Label>
            <Input id="inbound-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="자동 입력됩니다" />
          </div>

          {/* 상태 */}
          <div className="space-y-1.5">
            <Label>상태</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "등록 중..." : "입고 등록"}
          </Button>
        </form>

        {/* Recent inbound orders */}
        {recentOrders.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">최근 7일 입고 내역</h3>
            <div className="space-y-2">
              {recentOrders.map((order) => {
                const skuInfo = order.skus as { name: string; volume: string | null } | null;
                const statusKey = order.status ?? "pending";
                const statusLabel = STATUS_MAP[statusKey]?.label ?? statusKey;
                return (
                  <div key={order.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {skuInfo?.name ?? "알 수 없음"}
                        {skuInfo?.volume && <span className="text-muted-foreground ml-1 text-xs">({skuInfo.volume})</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        수량: {order.quantity?.toLocaleString() ?? 0}
                        {order.supplier && ` · ${order.supplier}`}
                        {order.created_at && ` · ${format(new Date(order.created_at), "MM/dd")}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", STATUS_BADGE_CLASS[statusKey])}>
                      {statusLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
