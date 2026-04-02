import { useState } from "react";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
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

const skuSchema = z.object({
  name: z.string().trim().min(1, "제품명을 입력해 주세요").max(200),
  category: z.enum(["cosmetics", "medical"], { required_error: "카테고리를 선택해 주세요" }),
  volume: z.string().max(100).optional(),
  supplier: z.string().max(200).optional(),
  safety_stock: z.number().int().min(0).default(0),
  unit_price: z.number().int().min(0).default(0),
  cert_grade: z.string().optional(),
  cert_number: z.string().max(100).optional(),
});

interface SkuFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkuFormSheet({ open, onOpenChange }: SkuFormSheetProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [volume, setVolume] = useState("");
  const [supplier, setSupplier] = useState("");
  const [safetyStock, setSafetyStock] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [certGrade, setCertGrade] = useState("");
  const [certNumber, setCertNumber] = useState("");

  const isMedical = category === "medical";

  function resetForm() {
    setName(""); setCategory(""); setVolume(""); setSupplier("");
    setSafetyStock(0); setUnitPrice(0); setCertGrade(""); setCertNumber("");
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = skuSchema.safeParse({
      name, category: category || undefined, volume: volume || undefined,
      supplier: supplier || undefined, safety_stock: safetyStock, unit_price: unitPrice,
      cert_grade: certGrade || undefined, cert_number: certNumber || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as string;
        fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    // For medical devices, store grade info in volume field as convention
    const volumeValue = isMedical
      ? [certGrade, certNumber].filter(Boolean).join(" / ") || parsed.data.volume
      : parsed.data.volume;

    const { error } = await supabase.from("skus").insert({
      name: parsed.data.name,
      category: parsed.data.category,
      volume: volumeValue ?? null,
      supplier: parsed.data.supplier ?? null,
      safety_stock: parsed.data.safety_stock,
      unit_price: parsed.data.unit_price,
    });

    setSubmitting(false);

    if (error) {
      toast.error("등록에 실패했습니다: " + error.message);
      return;
    }

    toast.success("SKU가 성공적으로 등록되었습니다.");
    queryClient.invalidateQueries({ queryKey: ["skus-with-inventory"] });
    resetForm();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>SKU 등록</SheetTitle>
          <SheetDescription>새로운 제품을 등록합니다.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* 제품명 */}
          <div className="space-y-1.5">
            <Label htmlFor="sku-name">제품명 <span className="text-destructive">*</span></Label>
            <Input id="sku-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 히알루론산 세럼" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* 카테고리 */}
          <div className="space-y-1.5">
            <Label>카테고리 <span className="text-destructive">*</span></Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cosmetics">화장품</SelectItem>
                <SelectItem value="medical">의료기기</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>

          {/* 용량/규격 */}
          <div className="space-y-1.5">
            <Label htmlFor="sku-volume">용량/규격</Label>
            <Input id="sku-volume" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="예: 30ml, 1ea" />
          </div>

          {/* 공급사 */}
          <div className="space-y-1.5">
            <Label htmlFor="sku-supplier">공급사</Label>
            <Input id="sku-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="공급사명" />
          </div>

          {/* 안전재고 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sku-safety">안전재고 기준</Label>
              <Input id="sku-safety" type="number" min={0} value={safetyStock} onChange={(e) => setSafetyStock(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sku-price">단가 (원)</Label>
              <Input id="sku-price" type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </div>
          </div>

          {/* 의료기기 추가 필드 */}
          {isMedical && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">의료기기 인증 정보</p>
              <div className="space-y-1.5">
                <Label>인증 구분</Label>
                <Select value={certGrade} onValueChange={setCertGrade}>
                  <SelectTrigger><SelectValue placeholder="선택하세요" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1등급 신고">1등급 신고</SelectItem>
                    <SelectItem value="2등급 허가">2등급 허가</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sku-cert-no">인증번호</Label>
                <Input id="sku-cert-no" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="인증번호 입력" />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "등록 중..." : "등록하기"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
