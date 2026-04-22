import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Activity } from 'lucide-react';
import type { MemberMeasurementRecord } from '@/lib/measurements/types';
import { buildMeasurementCallouts } from '@/lib/measurements/measurementToAvatar';

interface BodyFallbackCardProps {
  latest?: MemberMeasurementRecord | null;
  previous?: MemberMeasurementRecord | null;
  title?: string;
}

export function BodyFallbackCard({ latest, previous, title = 'Body Progress Snapshot' }: BodyFallbackCardProps) {
  const callouts = buildMeasurementCallouts(latest, previous).slice(0, 4);

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-lg shadow-primary/5">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="rounded-full bg-accent/10 p-2 text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              {title}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              3D is temporarily unavailable, so this comparison stays readable and motivating.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
            Fallback ready
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-secondary/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{latest?.weight_kg ?? '--'} kg</p>
            <p className="text-sm text-muted-foreground">{latest?.waist_cm ?? '--'} cm waist</p>
          </div>
          <div className="rounded-2xl bg-secondary/80 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Previous</p>
            <p className="mt-3 text-2xl font-semibold text-foreground">{previous?.weight_kg ?? '--'} kg</p>
            <p className="text-sm text-muted-foreground">{previous?.waist_cm ?? '--'} cm waist</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/85 p-4 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Momentum highlights
          </div>
          <div className="flex flex-wrap gap-2">
            {callouts.length ? (
              callouts.map((callout) => (
                <Badge
                  key={callout.key}
                  className="rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {callout.formatted}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-primary-foreground/80">Save two measurements to unlock richer comparison insights.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
