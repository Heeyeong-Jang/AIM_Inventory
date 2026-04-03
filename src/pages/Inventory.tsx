import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CosmeticsTable } from "@/components/dashboard/CosmeticsTable";
import { MedicalTable } from "@/components/dashboard/MedicalTable";
import { useDashboardData } from "@/hooks/useDashboardData";

const Inventory = () => {
  const { skus, isLoading } = useDashboardData();
  const [activeTab, setActiveTab] = useState("cosmetics");
  const [highlightSkuId] = useState<string | null>(null);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Inventory</h1>
        <p className="text-sm text-muted-foreground">제품별 재고 현황 및 상태</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">데이터를 불러오는 중...</div>
      ) : (
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
      )}
    </div>
  );
};

export default Inventory;
