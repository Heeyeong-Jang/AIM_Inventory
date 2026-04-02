import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricsRow } from "@/components/dashboard/MetricsRow";
import { CosmeticsTable } from "@/components/dashboard/CosmeticsTable";
import { MedicalTable } from "@/components/dashboard/MedicalTable";
import { SkuFormSheet } from "@/components/dashboard/SkuFormSheet";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { skus, totalSkus, lowStockCount, expiringSoonCount, inboundThisMonth, isLoading } = useDashboardData();
  const [skuFormOpen, setSkuFormOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
           <div>
            <h1 className="text-xl font-bold tracking-tight">SCM 대시보드</h1>
            <p className="text-sm text-muted-foreground">재고 및 공급망 현황</p>
          </div>
          <div className="ml-auto">
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
            <MetricsRow
              totalSkus={totalSkus}
              lowStockCount={lowStockCount}
              expiringSoonCount={expiringSoonCount}
              inboundThisMonth={inboundThisMonth}
            />

            <Tabs defaultValue="cosmetics" className="space-y-4">
              <TabsList>
                <TabsTrigger value="cosmetics">화장품</TabsTrigger>
                <TabsTrigger value="medical">의료기기</TabsTrigger>
              </TabsList>
              <TabsContent value="cosmetics">
                <CosmeticsTable skus={skus} />
              </TabsContent>
              <TabsContent value="medical">
                <MedicalTable skus={skus} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
      <SkuFormSheet open={skuFormOpen} onOpenChange={setSkuFormOpen} />
    </div>
};

export default Index;
