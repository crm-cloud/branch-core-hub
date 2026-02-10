import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'text-foreground',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
};

const iconBgStyles = {
  default: 'bg-muted',
  accent: 'bg-accent/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
  info: 'bg-info/10',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <Card className={cn('rounded-xl border-none shadow-lg shadow-indigo-100 transition-all hover:shadow-xl', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <div className={cn('p-2 rounded-lg', iconBgStyles[variant])}>
            <Icon className={cn('h-4 w-4', variantStyles[variant])} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold text-slate-800', variantStyles[variant] !== 'text-foreground' && variantStyles[variant])}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-xs mt-1',
            trend.isPositive ? 'text-success' : 'text-destructive'
          )}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}% from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
