import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Box, Camera, Minus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { hydrateMeasurementPhotoUrls } from '@/lib/measurements/photoSigning';
import type { MemberMeasurementRecord } from '@/lib/measurements/types';
import { MeasurementMetricsTab } from './MeasurementMetricsTab';
import { MeasurementPhotoGallery } from './MeasurementPhotoGallery';
import { BodyComparisonView } from '@/components/progress3d/BodyComparisonView';
import { hasBodyShapeMeasurements } from '@/lib/measurements/measurementToAvatar';

interface MeasurementProgressViewProps {
  memberId: string;
  memberGender?: string | null;
}

export function MeasurementProgressView({ memberId, memberGender }: MeasurementProgressViewProps) {
  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['member-measurements', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_measurements')
        .select('*, recorded_by_profile:profiles!member_measurements_recorded_by_fkey(full_name)')
        .eq('member_id', memberId)
        .order('recorded_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return hydrateMeasurementPhotoUrls((data || []) as MemberMeasurementRecord[]);
    },
    enabled: !!memberId,
  });

  const getWeightTrend = (current: number | null, previous: number | null, goal: 'lose' | 'gain' | 'maintain' = 'maintain') => {
    if (!current || !previous) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.1) return { text: 'Stable', color: 'text-muted-foreground' };
    
    if (goal === 'lose') {
      return diff < 0 
        ? { text: `${Math.abs(diff).toFixed(1)} kg lost`, color: 'text-success' }
        : { text: `${diff.toFixed(1)} kg gained`, color: 'text-destructive' };
    }
    
    if (goal === 'gain') {
      return diff > 0 
        ? { text: `${diff.toFixed(1)} kg gained`, color: 'text-success' }
        : { text: `${Math.abs(diff).toFixed(1)} kg lost`, color: 'text-destructive' };
    }

    return { text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`, color: 'text-muted-foreground' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (measurements.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 text-center">
          <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No measurements recorded yet</p>
        </CardContent>
      </Card>
    );
  }

  const latest = measurements[0];
  const previous = measurements[1];
  const weightTrend = getWeightTrend(latest?.weight_kg, previous?.weight_kg);
  const bmi = latest?.weight_kg && latest?.height_cm
    ? (latest.weight_kg / Math.pow(latest.height_cm / 100, 2)).toFixed(1)
    : null;

  return (
    <Tabs defaultValue="measurements" className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/85 p-1 shadow-lg shadow-primary/20">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl bg-transparent p-0">
          <TabsTrigger value="measurements" className="gap-2 rounded-xl data-[state=active]:bg-primary-foreground data-[state=active]:text-primary">
            <Scale className="h-4 w-4" />
            Measurements
          </TabsTrigger>
          <TabsTrigger value="photos" className="gap-2 rounded-xl data-[state=active]:bg-primary-foreground data-[state=active]:text-primary">
            <Camera className="h-4 w-4" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="body-3d" className="gap-2 rounded-xl data-[state=active]:bg-primary-foreground data-[state=active]:text-primary">
            <Box className="h-4 w-4" />
            3D Body
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="measurements" className="mt-0">
        <MeasurementMetricsTab latest={latest} previous={previous} weightTrend={weightTrend} bmi={bmi} history={measurements.slice(1, 5)} />
      </TabsContent>

      <TabsContent value="photos" className="mt-0">
        <MeasurementPhotoGallery latest={latest} />
      </TabsContent>

      <TabsContent value="body-3d" className="mt-0">
        <BodyComparisonView latest={latest} previous={previous} memberGender={memberGender} />
      </TabsContent>
    </Tabs>
  );
}
