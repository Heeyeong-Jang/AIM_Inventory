import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricsRow } from "@/components/dashboard/MetricsRow";
import { CosmeticsTable } from "@/components/dashboard/CosmeticsTable";
import { MedicalTable } from "@/components/dashboard/MedicalTable";
import { SkuFormSheet } from "@/components/dashboard/SkuFormSheet";
import { InboundFormSheet } from "@/components/dashboard/InboundFormSheet";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { OutboundFormSheet } from "@/components/dashboard/OutboundFormSheet";
import { useDashboardData, type AlertItem } from "@/hooks/useDashboardData";
import { Package, Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const {
    skus, totalSkus, lowStockCount, expiringSoonCount,
    inboundThisMonth, alerts, totalAlertCount, isLoading,
  } = useDashboardData();
  const [skuFormOpen, setSkuFormOpen] = useState(false);
  const [inboundFormOpen, setInboundFormOpen] = useState(false);
  const [outboundFormOpen, setOutboundFormOpen] = useState(false);
  const [highlightSkuId, setHighlightSkuId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("cosmetics");

  const handleAlertClick = useCallback((alert: AlertItem) => {
    // Switch to correct tab
    const tab = alert.category === "medical" ? "medical" : "cosmetics";
    setActiveTab(tab);
    setHighlightSkuId(alert.skuId);

    // Scroll to row after tab switch renders
    setTimeout(() => {
      const el = document.getElementById(`sku-row-${alert.skuId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    // Clear highlight after 3s
    setTimeout(() => setHighlightSkuId(null), 3000);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="relative p-2 rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
            {totalAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {totalAlertCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">SCM 대시보드</h1>
            <p className="text-sm text-muted-foreground">재고 및 공급망 현황</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setInboundFormOpen(true)} size="sm" variant="outline">
              <ArrowDownToLine className="h-4 w-4 mr-1.5" />
              입고 등록
            </Button>
            <Button onClick={() => setSkuFormOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              SKU 등록
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">데이터를 불러오는 중...</div>
        ) : (
          <>
            <AlertBanner alerts={alerts} onAlertClick={handleAlertClick} />

            <MetricsRow
              totalSkus={totalSkus}
              lowStockCount={lowStockCount}
              expiringSoonCount={expiringSoonCount}
              inboundThisMonth={inboundThisMonth}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="cosmetics">화장품</TabsTrigger>
                <TabsTrigger value="medical">의료기기</TabsTrigger>
              </TabsList>
              <TabsContent value="cosmetics">
                <CosmeticsTable skus={skus} highlightSkuId={highlightSkuId} />
              </TabsContent>
              <TabsContent value="medical">
                <MedicalTable skus={skus} highlightSkuId={highlightSkuId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      <SkuFormSheet open={skuFormOpen} onOpenChange={setSkuFormOpen} />
      <InboundFormSheet open={inboundFormOpen} onOpenChange={setInboundFormOpen} />
    </div>
  );
};

export default Index;
