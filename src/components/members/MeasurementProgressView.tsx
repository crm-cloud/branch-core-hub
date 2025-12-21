import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Minus, Scale, Ruler, Camera } from 'lucide-react';

interface MeasurementProgressViewProps {
  memberId: string;
}

export function MeasurementProgressView({ memberId }: MeasurementProgressViewProps) {
  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['member-measurements', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_measurements')
        .select('*, recorded_by_profile:recorded_by(full_name)')
        .eq('member_id', memberId)
        .order('recorded_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  const getTrendIcon = (current: number | null, previous: number | null) => {
    if (!current || !previous) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (current > previous) return <TrendingUp className="h-3 w-3 text-destructive" />;
    if (current < previous) return <TrendingDown className="h-3 w-3 text-success" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

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

  // Calculate BMI
  const bmi = latest?.weight_kg && latest?.height_cm
    ? (latest.weight_kg / Math.pow(latest.height_cm / 100, 2)).toFixed(1)
    : null;

  return (
    <div className="space-y-4">
      {/* Latest Measurements Summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Latest Measurements
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {format(new Date(latest.recorded_at), 'dd MMM yyyy')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Weight & BMI */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{latest.weight_kg || '--'}</p>
              <p className="text-xs text-muted-foreground">Weight (kg)</p>
              {weightTrend && (
                <p className={`text-xs ${weightTrend.color}`}>{weightTrend.text}</p>
              )}
            </div>
            <div>
              <p className="text-2xl font-bold">{latest.height_cm || '--'}</p>
              <p className="text-xs text-muted-foreground">Height (cm)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{bmi || '--'}</p>
              <p className="text-xs text-muted-foreground">BMI</p>
            </div>
          </div>

          {/* Body Measurements */}
          {(latest.chest_cm || latest.waist_cm || latest.hips_cm) && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                Body Measurements (cm)
              </p>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                {latest.chest_cm && (
                  <div>
                    <p className="font-medium">{latest.chest_cm}</p>
                    <p className="text-xs text-muted-foreground">Chest</p>
                  </div>
                )}
                {latest.waist_cm && (
                  <div>
                    <p className="font-medium">{latest.waist_cm}</p>
                    <p className="text-xs text-muted-foreground">Waist</p>
                  </div>
                )}
                {latest.hips_cm && (
                  <div>
                    <p className="font-medium">{latest.hips_cm}</p>
                    <p className="text-xs text-muted-foreground">Hips</p>
                  </div>
                )}
                {latest.biceps_left_cm && (
                  <div>
                    <p className="font-medium">{latest.biceps_left_cm}</p>
                    <p className="text-xs text-muted-foreground">Biceps</p>
                  </div>
                )}
                {latest.thighs_left_cm && (
                  <div>
                    <p className="font-medium">{latest.thighs_left_cm}</p>
                    <p className="text-xs text-muted-foreground">Thighs</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progress Photos */}
          {latest.photos && Array.isArray(latest.photos) && latest.photos.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Camera className="h-3 w-3" />
                Progress Photos
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(latest.photos as string[]).slice(0, 4).map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Progress ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {measurements.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Measurement History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {measurements.slice(1, 5).map((m: any, index: number) => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{m.weight_kg || '--'} kg</span>
                      {m.body_fat_percentage && (
                        <span className="text-muted-foreground ml-2">
                          {m.body_fat_percentage}% BF
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(m.recorded_at), 'dd MMM yyyy')}
                    </p>
                    {(m.recorded_by_profile as any)?.full_name && (
                      <p className="text-xs text-muted-foreground">
                        By: {(m.recorded_by_profile as any).full_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
