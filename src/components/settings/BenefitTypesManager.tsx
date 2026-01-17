import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

export interface BenefitTypeRecord {
  id: string;
  branch_id: string;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  is_bookable: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  category: string | null;
  default_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

const ICON_OPTIONS = [
  "Sparkles", "Thermometer", "Snowflake", "Droplets", "Flame", "Wind", 
  "Dumbbell", "Heart", "Star", "Zap", "Sun", "Moon", "Coffee", "Bath"
];

const CATEGORY_OPTIONS = [
  { value: "wellness", label: "Wellness" },
  { value: "fitness", label: "Fitness" },
  { value: "amenity", label: "Amenity" },
  { value: "service", label: "Service" },
];

interface BenefitTypeFormData {
  name: string;
  code: string;
  description: string;
  icon: string;
  is_bookable: boolean;
  is_active: boolean;
  category: string;
  default_duration_minutes: number;
}

const defaultFormData: BenefitTypeFormData = {
  name: "",
  code: "",
  description: "",
  icon: "Sparkles",
  is_bookable: true,
  is_active: true,
  category: "wellness",
  default_duration_minutes: 30,
};

function getIconComponent(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />;
}

export function BenefitTypesManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<BenefitTypeFormData>(defaultFormData);

  // Get first branch
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").limit(1);
      if (error) throw error;
      return data;
    },
  });

  const branchId = branches?.[0]?.id || "";

  // Fetch benefit types
  const { data: benefitTypes, isLoading } = useQuery({
    queryKey: ["benefit-types", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("benefit_types")
        .select("*")
        .eq("branch_id", branchId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as BenefitTypeRecord[];
    },
    enabled: !!branchId,
  });

  // Create/Update mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: BenefitTypeFormData & { id?: string }) => {
      const payload = {
        branch_id: branchId,
        name: data.name,
        code: data.code.toLowerCase().replace(/\s+/g, "_"),
        description: data.description || null,
        icon: data.icon,
        is_bookable: data.is_bookable,
        is_active: data.is_active,
        category: data.category,
        default_duration_minutes: data.default_duration_minutes,
      };

      if (data.id) {
        const { data: result, error } = await supabase
          .from("benefit_types")
          .update(payload)
          .eq("id", data.id)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from("benefit_types")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benefit-types"] });
      toast.success(editingId ? "Benefit type updated" : "Benefit type created");
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save benefit type");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("benefit_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["benefit-types"] });
      toast.success("Benefit type deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete benefit type");
    },
  });

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (benefitType: BenefitTypeRecord) => {
    setFormData({
      name: benefitType.name,
      code: benefitType.code,
      description: benefitType.description || "",
      icon: benefitType.icon || "Sparkles",
      is_bookable: benefitType.is_bookable ?? true,
      is_active: benefitType.is_active ?? true,
      category: benefitType.category || "wellness",
      default_duration_minutes: benefitType.default_duration_minutes || 30,
    });
    setEditingId(benefitType.id);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      toast.error("Please fill in required fields");
      return;
    }
    upsertMutation.mutate({ ...formData, id: editingId || undefined });
  };

  const generateCode = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  };

  if (!branchId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No branch found. Please create a branch first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Benefit Types</h2>
            <p className="text-muted-foreground">
              Manage custom benefits like Sauna, Ice Bath, Steam Room, etc.
            </p>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Benefit Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Benefit Type" : "Add Benefit Type"}</DialogTitle>
              <DialogDescription>
                Create custom benefit types that can be included in membership plans
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        name: e.target.value,
                        code: editingId ? formData.code : generateCode(e.target.value),
                      });
                    }}
                    placeholder="Ice Bath, Sauna, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code *</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="ice_bath"
                    disabled={!!editingId}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this benefit..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(v) => setFormData({ ...formData, icon: v })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          {getIconComponent(formData.icon)}
                          {formData.icon}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          <span className="flex items-center gap-2">
                            {getIconComponent(icon)}
                            {icon}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.default_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, default_duration_minutes: parseInt(e.target.value) || 30 })}
                  min={5}
                  max={180}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Requires Slot Booking</Label>
                  <p className="text-xs text-muted-foreground">Enable time-based booking for this benefit</p>
                </div>
                <Switch
                  checked={formData.is_bookable}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_bookable: checked })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>Active</Label>
                  <p className="text-xs text-muted-foreground">Show in benefit selection</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading benefit types...</div>
      ) : benefitTypes && benefitTypes.length > 0 ? (
        <div className="grid gap-3">
          {benefitTypes.map((bt) => (
            <Card key={bt.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getIconComponent(bt.icon || "Sparkles")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bt.name}</span>
                      <Badge variant="outline" className="text-xs">{bt.code}</Badge>
                      {bt.is_bookable && (
                        <Badge variant="secondary" className="text-xs">Bookable</Badge>
                      )}
                      {!bt.is_active && (
                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    {bt.description && (
                      <p className="text-sm text-muted-foreground">{bt.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(bt)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this benefit type?")) {
                        deleteMutation.mutate(bt.id);
                      }
                    }}
                  >
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
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">
              No benefit types created yet. Add custom benefits like Ice Bath, Sauna, Steam Room, etc.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Benefit Type
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
