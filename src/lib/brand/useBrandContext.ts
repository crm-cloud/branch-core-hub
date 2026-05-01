// Branded document context. Resolves company + branch info for PDFs.
// All PDF builders should accept a BrandContext rather than hardcoding strings.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BrandContext {
  companyName: string;        // Display brand
  legalName: string;          // Legal footer brand
  website: string;
  supportEmail: string;
  logoUrl?: string | null;
  branch: {
    id?: string | null;
    name: string;
    code?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
  };
}

export const DEFAULT_BRAND: Omit<BrandContext, 'branch'> = {
  companyName: 'Incline Fitness',
  legalName: 'The Incline Life by Incline',
  website: 'theincline.in',
  supportEmail: 'hello@theincline.in',
  logoUrl: null,
};

export function useBrandContext(branchId?: string | null) {
  return useQuery({
    queryKey: ['brand-context', branchId || 'global'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BrandContext> => {
      let branch: BrandContext['branch'] = { name: 'All Branches' };
      if (branchId) {
        const { data } = await supabase
          .from('branches')
          .select('id, name, code, address, phone, email, gstin')
          .eq('id', branchId)
          .maybeSingle();
        if (data) {
          branch = {
            id: data.id,
            name: data.name,
            code: (data as any).code ?? null,
            address: data.address ?? null,
            phone: data.phone ?? null,
            email: data.email ?? null,
            gstin: (data as any).gstin ?? null,
          };
        }
      }
      return { ...DEFAULT_BRAND, branch };
    },
  });
}

// Synchronous resolver for callers that already have a branch row in scope.
export function buildBrandFromBranch(branch?: Partial<BrandContext['branch']> | null): BrandContext {
  return {
    ...DEFAULT_BRAND,
    branch: {
      name: branch?.name || 'Incline Fitness',
      code: branch?.code ?? null,
      address: branch?.address ?? null,
      phone: branch?.phone ?? null,
      email: branch?.email ?? null,
      gstin: branch?.gstin ?? null,
      id: branch?.id ?? null,
    },
  };
}
