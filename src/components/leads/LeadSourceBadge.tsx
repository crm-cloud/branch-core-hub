import { Badge } from '@/components/ui/badge';
import { getLeadSourceMeta } from '@/lib/leadSource';
import { cn } from '@/lib/utils';

interface LeadSourceBadgeProps {
  source?: string | null;
  className?: string;
  compact?: boolean;
}

export function LeadSourceBadge({ source, className, compact = false }: LeadSourceBadgeProps) {
  const { label, icon: Icon, iconClassName } = getLeadSourceMeta(source);

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-border/70 bg-background/70',
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        className,
      )}
    >
      <Icon className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', iconClassName)} />
      <span className="leading-none">{label}</span>
    </Badge>
  );
}