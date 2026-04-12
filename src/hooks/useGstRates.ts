import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_GST_RATES = [5, 12, 18, 28];

export function useGstRates() {
  return useQuery({
    queryKey: ['org-gst-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('gst_rates')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const rates = data?.gst_rates as number[] | null;
      return (rates && Array.isArray(rates) && rates.length > 0) ? rates : DEFAULT_GST_RATES;
    },
    staleTime: 5 * 60 * 1000,
  });
}
