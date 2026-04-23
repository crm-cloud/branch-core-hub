import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Hand, Dumbbell, UtensilsCrossed, ChevronRight, Library, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FitnessHubTabs } from '@/components/fitness/FitnessHubTabs';
import { useQuery } from '@tanstack/react-query';
import { fetchPlanTemplates } from '@/services/fitnessService';
import { fetchMealCatalog } from '@/services/mealCatalogService';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';

export default function CreateModePickerPage() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['owner', 'admin']);
  const canSeePipeline = hasAnyRole(['owner', 'admin', 'manager']);
  const { effectiveBranchId } = useBranchContext();

  // Lightweight pipeline counts so the landing surfaces the Catalog →
  // Templates → Assignments flow at a glance. All queries are gated behind
  // canSeePipeline so members never trigger them.
  const { data: catalogCount = 0 } = useQuery({
    queryKey: ['fitness-pipeline-catalog', effectiveBranchId],
    queryFn: async () => {
      const rows = await fetchMealCatalog({ branchId: effectiveBranchId ?? null });
      return rows.length;
    },
    enabled: canSeePipeline,
  });
  const { data: templateCount = 0 } = useQuery({
    queryKey: ['fitness-pipeline-templates', effectiveBranchId],
    queryFn: async () => {
      const rows = await fetchPlanTemplates(effectiveBranchId ?? undefined);
      return rows.length;
    },
    enabled: canSeePipeline,
  });
  const { data: assignmentCount = 0 } = useQuery({
    queryKey: ['fitness-pipeline-assignments', effectiveBranchId],
    queryFn: async () => {
      let q = supabase.from('member_fitness_plans').select('id', { count: 'exact', head: true });
      if (effectiveBranchId) q = q.eq('branch_id', effectiveBranchId);
      const { count, error } = await q;
      if (error) {
        console.warn('assignment count failed:', error.message);
        return 0;
      }
      return count ?? 0;
    },
    enabled: canSeePipeline,
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <FitnessHubTabs />
        {canSeePipeline && (
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
            <PipelineTile
              icon={<UtensilsCrossed className="h-5 w-5" />}
              title="Meal Catalog"
              count={catalogCount}
              label={catalogCount === 1 ? 'meal' : 'meals'}
              hint="Source ingredients & macros"
              onClick={() => navigate('/fitness/meal-catalog')}
            />
            <PipelineArrow />
            <PipelineTile
              icon={<Library className="h-5 w-5" />}
              title="Plan Templates"
              count={templateCount}
              label={templateCount === 1 ? 'template' : 'templates'}
              hint="Reusable plans for any goal"
              onClick={() => navigate('/fitness/templates')}
            />
            <PipelineArrow />
            <PipelineTile
              icon={<Users className="h-5 w-5" />}
              title="Member Assignments"
              count={assignmentCount}
              label={assignmentCount === 1 ? 'plan' : 'plans'}
              hint="Active workout & diet plans"
              onClick={() => navigate('/fitness/member-plans')}
            />
          </div>
        )}

        <div className="max-w-5xl space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Create a Plan</h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Choose how you want to build the plan — let AI generate a personalized program, or build one manually.'
              : 'Build a workout or diet plan for one of your clients.'}
          </p>
        </div>

        <div className={`grid gap-4 ${isAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          {isAdmin && (
            <Card className="rounded-2xl border-primary/30 hover:border-primary transition-colors cursor-pointer group" onClick={() => navigate('/fitness/create/ai')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">AI-Generated Plan</CardTitle>
                    <CardDescription>Smart, personalized plans in seconds</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li>• Pre-fills member metrics (age, weight, BMI, goals)</li>
                  <li>• Tailored to dietary preference & cuisine</li>
                  <li>• Workout or diet plans for any goal</li>
                </ul>
                <Button className="w-full mt-2 group-hover:translate-x-0.5 transition-transform">
                  Start with AI <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border hover:border-accent transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Hand className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-xl">Build Manually</CardTitle>
                  <CardDescription>Full control over every detail</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/fitness/create/manual/workout')}
                >
                  <Dumbbell className="h-5 w-5" />
                  <span className="text-sm">Workout Plan</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={() => navigate('/fitness/create/manual/diet')}
                >
                  <UtensilsCrossed className="h-5 w-5" />
                  <span className="text-sm">Diet Plan</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Day-by-day exercises with sets/reps/rest, or meals with live macro tracking.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="ghost" className="justify-between h-auto py-3" onClick={() => navigate('/fitness/templates')}>
            <span className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              Browse Template Library
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="justify-between h-auto py-3" onClick={() => navigate('/fitness/member-plans')}>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              View Assigned Member Plans
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function PipelineTile({
  icon,
  title,
  count,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 text-left rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md transition-all p-4 group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{hint}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {count}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{label}</span>
      </p>
    </button>
  );
}

function PipelineArrow() {
  return (
    <div className="hidden sm:flex items-center justify-center text-muted-foreground/60">
      <ArrowRight className="h-4 w-4" />
    </div>
  );
}
