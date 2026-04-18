import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, UserPlus, Sparkles, Dumbbell, UtensilsCrossed, AlertCircle, Bookmark, Loader2 } from 'lucide-react';
import { CreateFlowLayout } from '@/components/fitness/create/CreateFlowLayout';
import { AssignPlanDrawer } from '@/components/fitness/AssignPlanDrawer';
import { loadDraft, PlanDraft } from '@/lib/planDraft';
import { useBranchContext } from '@/contexts/BranchContext';
import { createPlanTemplate } from '@/services/fitnessService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function PreviewPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const { effectiveBranchId } = useBranchContext();
  const queryClient = useQueryClient();

  const handleSaveAsTemplate = async () => {
    if (!draft) return;
    setSavingTemplate(true);
    try {
      const tpl = await createPlanTemplate({
        branch_id: effectiveBranchId ?? null,
        name: draft.name,
        type: draft.type,
        description: draft.description,
        difficulty: draft.difficulty,
        goal: draft.goal,
        content: draft.content,
      });
      setSavedTemplateId(tpl.id);
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
      toast.success('Saved as template');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  useEffect(() => {
    if (planId) setDraft(loadDraft(planId));
  }, [planId]);

  const editPath = useMemo(() => {
    if (!draft) return '/fitness/create';
    if (draft.source === 'ai') return '/fitness/create/ai';
    if (draft.source === 'manual-workout') return '/fitness/create/manual/workout';
    return '/fitness/create/manual/diet';
  }, [draft]);

  if (!planId || !draft) {
    return (
      <CreateFlowLayout title="Preview" step="preview" backTo="/fitness/create">
        <Card className="border-warning/30">
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-warning" />
            <h3 className="text-lg font-semibold">Plan draft not found</h3>
            <p className="text-sm text-muted-foreground">
              This draft is no longer available — drafts only exist for the current browser session.
            </p>
            <Button onClick={() => navigate('/fitness/create')}>Start a new plan</Button>
          </CardContent>
        </Card>
      </CreateFlowLayout>
    );
  }

  const isWorkout = draft.type === 'workout';

  return (
    <>
      <CreateFlowLayout
        title="Preview Plan"
        subtitle={draft.name}
        step="preview"
        backTo={editPath}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(editPath)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit before assign
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate || !!savedTemplateId}
              className="gap-1.5"
            >
              {savingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bookmark className="h-4 w-4" />
              )}
              {savedTemplateId ? 'Saved as template' : 'Save as template'}
            </Button>
            <Button onClick={() => setAssignOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Assign to member
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Summary */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {isWorkout ? <Dumbbell className="h-4 w-4" /> : <UtensilsCrossed className="h-4 w-4" />}
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge>{draft.type}</Badge>
                {draft.source === 'ai' && <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" />AI</Badge>}
                {draft.difficulty && <Badge variant="secondary">{draft.difficulty}</Badge>}
                {draft.goal && <Badge variant="secondary">{draft.goal}</Badge>}
              </div>
              {draft.description && <p className="text-muted-foreground">{draft.description}</p>}
              <div className="space-y-1.5 pt-2 border-t">
                {draft.memberName && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Member</span><span className="font-medium">{draft.memberName}</span></div>
                )}
                {draft.memberCode && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Code</span><span>{draft.memberCode}</span></div>
                )}
                {draft.dietaryType && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Dietary type</span><span className="capitalize">{draft.dietaryType.replace(/_/g, ' ')}</span></div>
                )}
                {draft.cuisine && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Cuisine</span><span className="capitalize">{draft.cuisine}</span></div>
                )}
                {draft.caloriesTarget && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Daily calories</span><span>{draft.caloriesTarget}</span></div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plan body */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-4">
                {isWorkout ? <WorkoutPreview content={draft.content} /> : <DietPreview content={draft.content} />}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </CreateFlowLayout>

      <AssignPlanDrawer
        open={assignOpen}
        onOpenChange={setAssignOpen}
        plan={{
          name: draft.name,
          type: draft.type,
          description: draft.description,
          content: draft.content,
        }}
        branchId={effectiveBranchId ?? undefined}
      />
    </>
  );
}

function WorkoutPreview({ content }: { content: any }) {
  const weeks = content?.weeks || [];
  if (!weeks.length) {
    return <p className="text-sm text-muted-foreground">No workout days configured.</p>;
  }
  return (
    <div className="space-y-5">
      {weeks.map((wk: any, wi: number) => (
        <div key={wi} className="space-y-3">
          {weeks.length > 1 && <h4 className="font-semibold text-sm text-primary">Week {wk.week}</h4>}
          {(wk.days || []).map((d: any, di: number) => (
            <div key={di} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{d.day}</p>
                  <p className="text-xs text-muted-foreground">{d.focus}</p>
                </div>
                <Badge variant="secondary" className="text-xs">{d.exercises?.length || 0} exercises</Badge>
              </div>
              <ul className="space-y-1.5">
                {(d.exercises || []).map((ex: any, ei: number) => (
                  <li key={ei} className="text-sm flex items-start justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="font-medium">{ei + 1}. {ex.name}</p>
                      {ex.notes && <p className="text-xs text-muted-foreground">{ex.notes}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {ex.sets}×{ex.reps}{ex.rest ? ` • ${ex.rest}` : ''}{ex.weight ? ` • ${ex.weight}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DietPreview({ content }: { content: any }) {
  // Manual diet stores `slots`; AI diet stores `meals` (array of days)
  if (content?.slots?.length) {
    return (
      <div className="space-y-3">
        {content.slots.map((s: any, i: number) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">{s.name} <span className="text-xs text-muted-foreground">• {s.time}</span></p>
              <Badge variant="secondary" className="text-xs">{Math.round(s.totals?.calories || 0)} cal</Badge>
            </div>
            <ul className="space-y-1">
              {(s.items || []).map((it: any, ii: number) => (
                <li key={ii} className="text-sm flex items-center justify-between py-1">
                  <span>{it.food} <span className="text-xs text-muted-foreground">{it.quantity}</span></span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(it.calories)}cal · P{it.protein} C{it.carbs} F{it.fats}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (content?.meals?.length) {
    return (
      <div className="space-y-3">
        {content.meals.map((d: any, di: number) => (
          <div key={di} className="rounded-lg border p-3">
            <p className="font-semibold text-sm mb-2">{d.day}</p>
            <ul className="space-y-1 text-sm">
              {d.breakfast && <li className="flex justify-between"><span>🌅 {d.breakfast.meal}</span><span className="text-xs text-muted-foreground">{d.breakfast.calories} cal</span></li>}
              {d.snack1 && <li className="flex justify-between"><span>🍎 {d.snack1.meal}</span><span className="text-xs text-muted-foreground">{d.snack1.calories} cal</span></li>}
              {d.lunch && <li className="flex justify-between"><span>🍽️ {d.lunch.meal}</span><span className="text-xs text-muted-foreground">{d.lunch.calories} cal</span></li>}
              {d.snack2 && <li className="flex justify-between"><span>🥜 {d.snack2.meal}</span><span className="text-xs text-muted-foreground">{d.snack2.calories} cal</span></li>}
              {d.dinner && <li className="flex justify-between"><span>🌙 {d.dinner.meal}</span><span className="text-xs text-muted-foreground">{d.dinner.calories} cal</span></li>}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">No meals configured.</p>;
}
