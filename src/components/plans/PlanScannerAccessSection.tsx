import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Scan } from 'lucide-react';

export interface ScannerAccessValue {
  body_scan_allowed: boolean;
  posture_scan_allowed: boolean;
  scans_per_month: number; // 0 = unlimited
}

interface Props {
  value: ScannerAccessValue;
  onChange: (next: ScannerAccessValue) => void;
}

export function PlanScannerAccessSection({ value, onChange }: Props) {
  const update = (patch: Partial<ScannerAccessValue>) => onChange({ ...value, ...patch });
  const eitherOn = value.body_scan_allowed || value.posture_scan_allowed;

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Scan className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Body Scanner Access (HOWBODY)</p>
          <p className="text-xs text-muted-foreground">
            Enable body composition / posture scans on the gym's HOWBODY device for this plan.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Body Composition Scan</Label>
          <p className="text-xs text-muted-foreground">Weight, BMI, fat %, muscle, etc.</p>
        </div>
        <Switch
          checked={value.body_scan_allowed}
          onCheckedChange={(v) => update({ body_scan_allowed: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm">Posture Scan</Label>
          <p className="text-xs text-muted-foreground">Spine, shoulder & alignment analysis</p>
        </div>
        <Switch
          checked={value.posture_scan_allowed}
          onCheckedChange={(v) => update({ posture_scan_allowed: v })}
        />
      </div>

      {eitherOn && (
        <div className="space-y-1">
          <Label className="text-sm">Scans per month</Label>
          <Input
            type="number"
            min={0}
            value={value.scans_per_month}
            onChange={(e) => update({ scans_per_month: parseInt(e.target.value || '0', 10) })}
          />
          <p className="text-xs text-muted-foreground">
            Set <span className="font-medium">0</span> for unlimited. Members can buy add-on scan packs from the store.
          </p>
        </div>
      )}
    </div>
  );
}
