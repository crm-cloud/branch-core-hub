import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Package, ShoppingCart, Calendar, Coins, Thermometer, Snowflake, Dumbbell } from "lucide-react";
import { useBenefitPackages, usePurchaseBenefitCredits } from "@/hooks/useBenefitBookings";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type BenefitType = Database["public"]["Enums"]["benefit_type"];

interface PurchaseBenefitDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  membershipId: string | null;
  memberName: string;
  branchId: string;
  benefitType?: BenefitType;
}

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  sauna_session: <Thermometer className="h-5 w-5" />,
  ice_bath: <Snowflake className="h-5 w-5" />,
  personal_training: <Dumbbell className="h-5 w-5" />,
  group_classes: <Dumbbell className="h-5 w-5" />,
};

const BENEFIT_LABELS: Record<string, string> = {
  sauna_session: "Sauna Sessions",
  ice_bath: "Ice Bath Sessions",
  personal_training: "Personal Training",
  group_classes: "Group Classes",
};

export function PurchaseBenefitDrawer({
  open,
  onOpenChange,
  memberId,
  membershipId,
  memberName,
  branchId,
  benefitType,
}: PurchaseBenefitDrawerProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  
  const { data: packages, isLoading } = useBenefitPackages(branchId, benefitType);
  const purchaseCredits = usePurchaseBenefitCredits();
  
  const handlePurchase = async () => {
    if (!selectedPackage) return;
    
    try {
      await purchaseCredits.mutateAsync({
        memberId,
        membershipId,
        packageId: selectedPackage,
      });
      toast.success("Benefit credits purchased successfully!");
      setSelectedPackage(null);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to purchase credits");
    }
  };
  
  const selectedPkg = packages?.find((p) => p.id === selectedPackage);
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Purchase Additional Credits
          </SheetTitle>
          <SheetDescription>
            Buy extra benefit credits for: <span className="font-medium text-foreground">{memberName}</span>
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Loading packages...</div>
          ) : packages && packages.length > 0 ? (
            <RadioGroup value={selectedPackage || ""} onValueChange={setSelectedPackage}>
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`cursor-pointer transition-colors ${
                      selectedPackage === pkg.id ? "border-primary ring-2 ring-primary/20" : ""
                    }`}
                    onClick={() => setSelectedPackage(pkg.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={pkg.id} id={pkg.id} />
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {BENEFIT_ICONS[pkg.benefit_type] || <Package className="h-5 w-5" />}
                          </div>
                          <div>
                            <CardTitle className="text-base">{pkg.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {BENEFIT_LABELS[pkg.benefit_type] || pkg.benefit_type}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-lg font-bold">
                          ₹{pkg.price}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {pkg.quantity} credits
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Valid for {pkg.validity_days} days
                        </div>
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mt-2">{pkg.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </RadioGroup>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No packages available for purchase</p>
            </div>
          )}
          
          {selectedPkg && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{selectedPkg.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedPkg.quantity} credits • Valid {selectedPkg.validity_days} days
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">₹{selectedPkg.price}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Button
            onClick={handlePurchase}
            disabled={!selectedPackage || purchaseCredits.isPending}
            className="w-full"
            size="lg"
          >
            {purchaseCredits.isPending ? "Processing..." : "Complete Purchase"}
          </Button>
          
          <p className="text-xs text-muted-foreground text-center">
            Credits will be added immediately after purchase
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
