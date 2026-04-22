import { Camera, ImageOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemberMeasurementRecord } from '@/lib/measurements/types';

interface MeasurementPhotoGalleryProps {
  latest?: MemberMeasurementRecord | null;
}

export function MeasurementPhotoGallery({ latest }: MeasurementPhotoGalleryProps) {
  const signedUrls = latest?.signedPhotoUrls ?? [];
  const dedicatedUrls = [latest?.frontProgressPhotoUrl, latest?.sideProgressPhotoUrl].filter(
    (url): url is string => Boolean(url),
  );
  const allUrls = Array.from(new Set([...dedicatedUrls, ...signedUrls]));

  if (!allUrls.length) {
    return (
      <Card className="rounded-2xl border-border/60 bg-card shadow-lg shadow-primary/5">
        <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <span className="rounded-full bg-secondary p-4 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </span>
          <div>
            <p className="font-medium text-foreground">No private progress photos yet</p>
            <p className="text-sm text-muted-foreground">New uploads stay protected and are loaded only with signed access.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-lg shadow-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-full bg-accent/10 p-2 text-accent">
            <Camera className="h-4 w-4" />
          </span>
          Private progress gallery
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {allUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              className="overflow-hidden rounded-2xl bg-secondary text-left transition-transform hover:scale-[1.01]"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            >
              <img
                src={url}
                alt={`Member progress photo ${index + 1}`}
                className="aspect-[4/5] w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}