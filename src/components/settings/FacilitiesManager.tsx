import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Building2, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useBenefitTypes } from "@/hooks/useBenefitTypes";
import * as LucideIcons from "lucide-react";

const GENDER_OPTIONS = [
  { value: "unisex", label: "Unisex (All)" },
  { value: "male", label: "Male Only" },
  { value: "female", label: "Female Only" },
];

interface FacilityFormData {
  name: string;
  benefit_type_id: string;
  gender_access: string;
  capacity: number;
  description: string;
  is_active: boolean;
}

const defaultFormData: FacilityFormData = {
  name: "",
  benefit_type_id: "",
  gender_access: "unisex",
  capacity: 1,
  description: "",
  is_active: true,
};

function getIconComponent(iconName: string | null) {
  if (!iconName) return <Sparkles className="h-5 w-5" />;
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />;
}

export function FacilitiesManager() {
  const queryClient = useQueryClient();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FacilityFormData>(defaultFormData);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id").limit(1);
      if (error) throw error;
      return data;
    },
  });
  const branchId = branches?.[0]?.id || "";

  const { data: benefitTypes } = useBenefitTypes(branchId);

  const { data: facilities, isLoading } = useQuery({
    queryKey: ["facilities", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("facilities")
        .select("*, benefit_type:benefit_types(id, name, icon)")
        .eq("branch_id", branchId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: FacilityFormData & { id?: string }) => {
      const payload = {
        branch_id: branchId,
        name: data.name,
        benefit_type_id: data.benefit_type_id,
        gender_access: data.gender_access,
        capacity: data.capacity,
        description: data.description || null,
        is_active: data.is_active,
      };
      if (data.id) {
        const { error } = await supabase.from("facilities").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("facilities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success(editingId ? "Facility updated" : "Facility created");
      resetForm();
    },
    onError: (error: any) => toast.error(error.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["facilities"] });
      toast.success("Facility deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete"),
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setIsDrawerOpen(false);
  };

  const handleEdit = (facility: any) => {
    setFormData({
      name: facility.name,
      benefit_type_id: facility.benefit_type_id,
      gender_access: facility.gender_access || "unisex",
      capacity: facility.capacity || 1,
      description: facility.description || "",
      is_active: facility.is_active ?? true,
    });
    setEditingId(facility.id);
    setIsDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.benefit_type_id) {
      toast.error("Please fill in required fields");
      return;
    }
    upsertMutation.mutate({ ...formData, id: editingId || undefined });
  };

  if (!branchId) return null;

  const genderBadgeVariant = (g: string) => {
    if (g === "male") return "default" as const;
    if (g === "female") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Facilities / Rooms</h2>
            <p className="text-muted-foreground">
              Physical rooms linked to benefit types with gender-based access control
            </p>
          </div>
        </div>
        <Button onClick={() => setIsDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Facility
        </Button>
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={(open) => { setIsDrawerOpen(open); if (!open) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingId ? "Edit Facility" : "Add Facility"}</SheetTitle>
            <SheetDescription>
              Create a physical room/space linked to a benefit category
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Facility Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Ice Bath - Male Room"
              />
            </div>

            <div className="space-y-2">
              <Label>Benefit Category *</Label>
              <Select
                value={formData.benefit_type_id}
                onValueChange={(v) => setFormData({ ...formData, benefit_type_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select benefit type" />
                </SelectTrigger>
                <SelectContent>
                  {benefitTypes?.map((bt) => (
                    <SelectItem key={bt.id} value={bt.id}>
                      <span className="flex items-center gap-2">
                        {getIconComponent(bt.icon)}
                        {bt.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Gender Access *</Label>
              <Select
                value={formData.gender_access}
                onValueChange={(v) => setFormData({ ...formData, gender_access: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                min={1}
                max={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Show in booking options</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <div className="text-center py-8">Loading facilities...</div>
      ) : facilities && facilities.length > 0 ? (
        <div className="grid gap-3">
          {facilities.map((f: any) => (
            <Card key={f.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getIconComponent(f.benefit_type?.icon)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="outline" className="text-xs">{f.benefit_type?.name}</Badge>
                      <Badge variant={genderBadgeVariant(f.gender_access)} className="text-xs capitalize">
                        {f.gender_access}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{f.capacity} cap</Badge>
                      {!f.is_active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                    {f.description && <p className="text-sm text-muted-foreground">{f.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(f)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (confirm("Delete this facility?")) deleteMutation.mutate(f.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              No facilities created yet. Add rooms like "Sauna - Male", "Ice Bath - Female", etc.
            </p>
            <Button onClick={() => setIsDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Facility
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
