import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, Info, AlertCircle } from 'lucide-react';

interface Insight {
  icon: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success' | 'critical';
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-sky-500/10 text-sky-600 border-sky-200',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-200',
  success: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
};

const SEVERITY_ICONS: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  success: TrendingUp,
  critical: AlertCircle,
};

export function AIInsightsWidget({ branchId }: { branchId?: string }) {
  const [insights, setInsights] = useState<Insight[]>(() => {
    const cached = localStorage.getItem('ai-insights-cache');
    if (cached) {
      try {
        const { insights: cachedInsights, timestamp, branch } = JSON.parse(cached);
        const hoursSinceCache = (Date.now() - timestamp) / (1000 * 60 * 60);
        if (hoursSinceCache < 24 && branch === (branchId || 'all')) {
          return cachedInsights;
        }
      } catch { /* ignore */ }
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-dashboard-insights', {
        body: { branch_id: branchId || null },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const newInsights = data?.insights || [];
      setInsights(newInsights);
      setLastGenerated(new Date().toLocaleTimeString());

      // Cache results
      localStorage.setItem('ai-insights-cache', JSON.stringify({
        insights: newInsights,
        timestamp: Date.now(),
        branch: branchId || 'all',
      }));

      toast.success('AI insights generated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate insights');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg rounded-2xl border-0 bg-gradient-to-br from-card to-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            AI Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastGenerated && (
              <span className="text-xs text-muted-foreground">Updated {lastGenerated}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={generateInsights}
              disabled={isLoading}
              className="rounded-xl gap-1.5"
            >
              {isLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {insights.length === 0 ? 'Generate' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-2.5">
            {insights.map((insight, idx) => {
              const SeverityIcon = SEVERITY_ICONS[insight.severity] || Info;
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info}`}
                >
                  <div className="text-xl flex-shrink-0 mt-0.5">{insight.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{insight.title}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                        {insight.severity}
                      </Badge>
                    </div>
                    <p className="text-xs mt-0.5 opacity-80">{insight.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-violet-500/50" />
            </div>
            <p className="text-sm text-muted-foreground">Click "Generate" to get AI-powered insights about your gym's performance</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
