import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BenefitTypeRecord } from "@/components/settings/BenefitTypesManager";

export function useBenefitTypes(branchId: string) {
  return useQuery({
    queryKey: ["benefit-types", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("benefit_types")
        .select("*")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as BenefitTypeRecord[];
    },
    enabled: !!branchId,
  });
}

export function useBookableBenefitTypes(branchId: string) {
  return useQuery({
    queryKey: ["benefit-types", branchId, "bookable"],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("benefit_types")
        .select("*")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .eq("is_bookable", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as BenefitTypeRecord[];
    },
    enabled: !!branchId,
  });
}

export function useCreateBenefitType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      branch_id: string;
      name: string;
      code: string;
      description?: string;
      icon?: string;
      is_bookable?: boolean;
      category?: string;
      default_duration_minutes?: number;
    }) => {
      const { data: result, error } = await supabase
        .from("benefit_types")
        .insert({
          branch_id: data.branch_id,
          name: data.name,
          code: data.code.toLowerCase().replace(/\s+/g, "_"),
          description: data.description || null,
          icon: data.icon || "Sparkles",
          is_bookable: data.is_bookable ?? true,
          is_active: true,
          category: data.category || "wellness",
          default_duration_minutes: data.default_duration_minutes || 30,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["benefit-types", variables.branch_id] });
    },
  });
}
