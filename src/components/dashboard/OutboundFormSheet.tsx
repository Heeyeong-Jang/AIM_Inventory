import { useState, useMemo } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronsUpDown, Check, CalendarIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNELS = ["피부과", "클리닉", "메디스파", "기타"] as const;

const outboundSchema = z.object({
  sku_id: z.string().uuid("SKU를 선택해 주세요"),
  lot_number: z.string().trim().min(1, "로트번호를 입력해 주세요").max(100),
  quantity: z.number().int().min(1, "수량은 1 이상이어야 합니다"),
  destination: z.string().trim().min(1, "납품처를 입력해 주세요").max(200),
  channel: z.string().min(1, "채널을 선택해 주세요"),
  shipped_at: z.date(),
});

interface OutboundFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutboundFormSheet({ open, onOpenChange }: OutboundFormSheetProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skuPopoverOpen, setSkuPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const [skuId, setSkuId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [destination, setDestination] = useState("");
  const [channel, setChannel] = useState("");
  const [shippedAt, setShippedAt] = useState<Date>(new Date());

  const skusQuery = useQuery({
    queryKey: ["skus-medical-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skus")
        .select("id, name, volume, supplier, safety_stock")
        .eq("category", "medical")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["outbound-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_logs")
        .select("*, skus(name, volume)")
        .order("shipped_at", { ascending: false })
        .limit(30);
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
  }

  function resetForm() {
    setSkuId(""); setLotNumber(""); setQuantity(1); setDestination("");
    setChannel(""); setShippedAt(new Date()); setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = outboundSchema.safeParse({
      sku_id: skuId || undefined,
      lot_number: lotNumber,
      quantity,
      destination,
      channel,
      shipped_at: shippedAt,
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

    // 1. Insert outbound log
    const { error: logError } = await supabase.from("outbound_logs").insert({
      sku_id: parsed.data.sku_id,
      quantity: parsed.data.quantity,
      lot_number: parsed.data.lot_number,
      destination: parsed.data.destination,
      channel: parsed.data.channel,
      shipped_at: parsed.data.shipped_at.toISOString(),
    });

    if (logError) {
      setSubmitting(false);
      toast.error("출고 등록에 실패했습니다: " + logError.message);
      return;
    }

    // 2. Subtract from inventory
    const { data: invRow } = await supabase
      .from("inventory")
      .select("id, quantity")
      .eq("sku_id", parsed.data.sku_id)
      .eq("lot_number", parsed.data.lot_number)
      .maybeSingle();

    if (invRow) {
      const newQty = Math.max((invRow.quantity ?? 0) - parsed.data.quantity, 0);
      await supabase
        .from("inventory")
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq("id", invRow.id);

      // 3. Check safety stock
      const safetyStock = selectedSku?.safety_stock ?? 0;
      // Get total qty for this SKU across all lots
      const { data: allInv } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("sku_id", parsed.data.sku_id);
      const totalAfter = (allInv ?? []).reduce((s, i) => s + (i.quantity ?? 0), 0)
        - (invRow.quantity ?? 0) + newQty; // account for the update we just did
      
      if (totalAfter < safetyStock) {
        toast.warning(`⚠️ ${selectedSku?.name ?? "해당 SKU"}의 재고가 안전재고(${safetyStock}) 이하입니다!`);
      }
    } else {
      toast.warning("해당 로트번호의 재고를 찾을 수 없습니다. 출고 기록만 저장됩니다.");
    }

    setSubmitting(false);
    toast.success("출고가 성공적으로 등록되었습니다.");
    queryClient.invalidateQueries({ queryKey: ["skus-with-inventory"] });
    queryClient.invalidateQueries({ queryKey: ["outbound-history"] });
    resetForm();
    onOpenChange(false);
  }

  const history = historyQuery.data ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>출고 등록</SheetTitle>
          <SheetDescription>의료기기 출고 정보를 등록합니다.</SheetDescription>
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
                    : "의료기기 SKU를 검색하세요"}
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

          {/* 로트번호 & 수량 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="out-lot">로트번호 <span className="text-destructive">*</span></Label>
              <Input id="out-lot" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder="LOT-2024-001" />
              {errors.lot_number && <p className="text-xs text-destructive">{errors.lot_number}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="out-qty">출고 수량 <span className="text-destructive">*</span></Label>
              <Input id="out-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
            </div>
          </div>

          {/* 납품처 */}
          <div className="space-y-1.5">
            <Label htmlFor="out-dest">납품처 <span className="text-destructive">*</span></Label>
            <Input id="out-dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="납품처명" />
            {errors.destination && <p className="text-xs text-destructive">{errors.destination}</p>}
          </div>

          {/* 채널 & 출고일 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>채널 <span className="text-destructive">*</span></Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((ch) => (
                    <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.channel && <p className="text-xs text-destructive">{errors.channel}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>출고일</Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(shippedAt, "yyyy-MM-dd")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shippedAt}
                    onSelect={(d) => { if (d) { setShippedAt(d); setDatePopoverOpen(false); } }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "등록 중..." : "출고 등록"}
          </Button>
        </form>

        {/* Outbound history */}
        {history.length > 0 && (
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">출고 내역</h3>
            <div className="rounded-lg border bg-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">출고일</TableHead>
                    <TableHead className="text-xs">제품명</TableHead>
                    <TableHead className="text-xs">로트번호</TableHead>
                    <TableHead className="text-xs text-right">수량</TableHead>
                    <TableHead className="text-xs">납품처</TableHead>
                    <TableHead className="text-xs">채널</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => {
                    const skuInfo = row.skus as { name: string; volume: string | null } | null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">{row.shipped_at ? format(new Date(row.shipped_at), "MM/dd") : "-"}</TableCell>
                        <TableCell className="text-xs font-medium">{skuInfo?.name ?? "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.lot_number ?? "-"}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{row.quantity?.toLocaleString() ?? 0}</TableCell>
                        <TableCell className="text-xs">{row.destination ?? "-"}</TableCell>
                        <TableCell>
                          {row.channel && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.channel}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Legal note */}
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3">
          <AlertTriangle className="h-4 w-4 text-status-warning-fg shrink-0 mt-0.5" />
          <p className="text-xs text-status-warning-fg">
            2등급 의료기기는 로트번호·납품처 기록이 법적 의무입니다.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
