import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scan, PersonStanding, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ScanQuota } from '@/hooks/useHowbodyReports';

interface Props {
  body?: ScanQuota;
  posture?: ScanQuota;
}

function QuotaBlock({ icon: Icon, label, q }: { icon: any; label: string; q?: ScanQuota }) {
  if (!q) return null;
  const usage = q.plan_limit > 0 ? `${q.used_this_month}/${q.plan_limit}` : `${q.used_this_month}`;
  const variant = q.allowed ? 'secondary' : 'destructive';
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
      <div className="rounded-full bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground leading-tight">
          {q.plan_allowed ? `${usage} this month` : 'Not in your plan'}
          {q.addon_remaining > 0 && ` · +${q.addon_remaining} add-on`}
        </p>
      </div>
      <Badge variant={variant} className="ml-auto rounded-full text-[10px]">
        {q.allowed ? 'Available' : 'Used up'}
      </Badge>
    </div>
  );
}

export function ScanQuotaStrip({ body, posture }: Props) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-md shadow-primary/5">
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
        <QuotaBlock icon={Scan} label="Body Composition" q={body} />
        <QuotaBlock icon={PersonStanding} label="Posture" q={posture} />
        <Button asChild size="sm" variant="outline" className="md:ml-auto">
          <Link to="/store">
            <Plus className="mr-1 h-4 w-4" /> Buy Add-On Scans
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
