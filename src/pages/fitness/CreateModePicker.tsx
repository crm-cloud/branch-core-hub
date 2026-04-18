import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Hand, Dumbbell, UtensilsCrossed, ChevronRight, Library, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FitnessHubTabs } from '@/components/fitness/FitnessHubTabs';

export default function CreateModePickerPage() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['owner', 'admin']);

  return (
    <AppLayout>
      <div className="space-y-6">
        <FitnessHubTabs />
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
