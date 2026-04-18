import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Dumbbell,
  Utensils,
  Loader2,
  Library,
  Trash2,
  Shuffle,
  Zap,
  UserPlus,
  Download,
  FilePlus,
} from "lucide-react";
import { generatePlanPDF } from "@/utils/pdfGenerator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlanTemplates,
  FitnessPlanTemplate,
} from "@/services/fitnessService";
import { AssignPlanDrawer } from "@/components/fitness/AssignPlanDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const DEFAULT_TEMPLATES = [
  {
    id: "default-beginner",
    name: "Beginner Full Body",
    type: "workout" as const,
    description: "3-day full body program for absolute beginners",
    difficulty: "beginner",
    goal: "General Fitness",
    isDefault: true,
    content: {
      name: "Beginner Full Body",
      type: "workout",
      difficulty: "beginner",
      goal: "General Fitness",
      description: "3-day full body program for absolute beginners",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Monday",
              focus: "Full Body A",
              exercises: [
                { name: "Bodyweight Squats", sets: 3, reps: "12", rest: "60s" },
                { name: "Push-ups (or Knee Push-ups)", sets: 3, reps: "10", rest: "60s" },
                { name: "Dumbbell Rows", sets: 3, reps: "10", rest: "60s" },
                { name: "Plank Hold", sets: 3, reps: "30s", rest: "45s" },
              ],
            },
            {
              day: "Wednesday",
              focus: "Full Body B",
              exercises: [
                { name: "Lunges", sets: 3, reps: "10/leg", rest: "60s" },
                { name: "Dumbbell Press", sets: 3, reps: "10", rest: "60s" },
                { name: "Lat Pulldown", sets: 3, reps: "12", rest: "60s" },
                { name: "Russian Twists", sets: 3, reps: "20", rest: "45s" },
              ],
            },
            {
              day: "Friday",
              focus: "Full Body C",
              exercises: [
                { name: "Goblet Squats", sets: 3, reps: "12", rest: "60s" },
                { name: "Incline Push-ups", sets: 3, reps: "12", rest: "60s" },
                { name: "Seated Cable Row", sets: 3, reps: "12", rest: "60s" },
                { name: "Dead Bug", sets: 3, reps: "10/side", rest: "45s" },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "default-weightloss",
    name: "Weight Loss Circuit",
    type: "workout" as const,
    description: "High-intensity circuit training for maximum calorie burn",
    difficulty: "intermediate",
    goal: "Weight Loss",
    isDefault: true,
    content: {
      name: "Weight Loss Circuit",
      type: "workout",
      difficulty: "intermediate",
      goal: "Weight Loss",
      description: "High-intensity circuit training for maximum calorie burn",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Monday",
              focus: "HIIT Circuit",
              exercises: [
                { name: "Burpees", sets: 4, reps: "10", rest: "30s" },
                { name: "Mountain Climbers", sets: 4, reps: "20", rest: "30s" },
                { name: "Jump Squats", sets: 4, reps: "15", rest: "30s" },
                { name: "Kettlebell Swings", sets: 4, reps: "15", rest: "30s" },
                { name: "Battle Ropes", sets: 4, reps: "30s", rest: "30s" },
              ],
            },
            {
              day: "Wednesday",
              focus: "Cardio + Core",
              exercises: [
                { name: "Treadmill Intervals", sets: 1, reps: "20 min", rest: "-" },
                { name: "Bicycle Crunches", sets: 3, reps: "20", rest: "30s" },
                { name: "Leg Raises", sets: 3, reps: "15", rest: "30s" },
                { name: "Box Jumps", sets: 4, reps: "10", rest: "45s" },
              ],
            },
            {
              day: "Friday",
              focus: "Full Body Burn",
              exercises: [
                { name: "Deadlifts", sets: 4, reps: "10", rest: "45s" },
                { name: "Push Press", sets: 4, reps: "10", rest: "45s" },
                { name: "Rowing Machine", sets: 1, reps: "500m", rest: "-" },
                { name: "Plank Jacks", sets: 3, reps: "20", rest: "30s" },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "default-muscle",
    name: "Muscle Building Split",
    type: "workout" as const,
    description: "Push/Pull/Legs split for hypertrophy",
    difficulty: "intermediate",
    goal: "Muscle Gain",
    isDefault: true,
    content: {
      name: "Muscle Building Split",
      type: "workout",
      difficulty: "intermediate",
      goal: "Muscle Gain",
      description: "Push/Pull/Legs split for hypertrophy",
      weeks: [
        {
          week: 1,
          days: [
            {
              day: "Monday",
              focus: "Push (Chest/Shoulders/Triceps)",
              exercises: [
                { name: "Bench Press", sets: 4, reps: "8-10", rest: "90s" },
                { name: "Overhead Press", sets: 3, reps: "10", rest: "90s" },
                { name: "Incline Dumbbell Press", sets: 3, reps: "12", rest: "60s" },
                { name: "Lateral Raises", sets: 3, reps: "15", rest: "45s" },
                { name: "Tricep Pushdowns", sets: 3, reps: "12", rest: "45s" },
              ],
            },
            {
              day: "Wednesday",
              focus: "Pull (Back/Biceps)",
              exercises: [
                { name: "Barbell Rows", sets: 4, reps: "8-10", rest: "90s" },
                { name: "Pull-ups", sets: 3, reps: "8", rest: "90s" },
                { name: "Face Pulls", sets: 3, reps: "15", rest: "45s" },
                { name: "Barbell Curls", sets: 3, reps: "12", rest: "45s" },
                { name: "Hammer Curls", sets: 3, reps: "12", rest: "45s" },
              ],
            },
            {
              day: "Friday",
              focus: "Legs",
              exercises: [
                { name: "Barbell Squats", sets: 4, reps: "8-10", rest: "120s" },
                { name: "Romanian Deadlifts", sets: 3, reps: "10", rest: "90s" },
                { name: "Leg Press", sets: 3, reps: "12", rest: "90s" },
                { name: "Leg Curls", sets: 3, reps: "12", rest: "60s" },
                { name: "Calf Raises", sets: 4, reps: "15", rest: "45s" },
              ],
            },
          ],
        },
      ],
    },
  },
];

function seededShuffle<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getDifficultyColor(difficulty: string | null) {
  switch (difficulty) {
    case "beginner":
      return "bg-success/20 text-success border-success/20";
    case "intermediate":
      return "bg-warning/20 text-warning border-warning/20";
    case "advanced":
      return "bg-destructive/20 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function FitnessTemplatesPage() {
  const { profile, hasAnyRole } = useAuth();
  const canCreate = hasAnyRole(["owner", "admin", "manager"]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [planType, setPlanType] = useState<"workout" | "diet">("workout");
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [shuffledWorkout, setShuffledWorkout] = useState<{ name: string; exercises: any[] } | null>(
    null,
  );

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["fitness-templates", planType],
    queryFn: () => fetchPlanTemplates(undefined, planType),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("fitness_plan_templates")
        .update({ is_active: false })
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["fitness-templates"] });
    },
  });

  const handleQuickShuffle = () => {
    const seed = `${profile?.id || "guest"}-${new Date().toISOString().split("T")[0]}`;
    const allExercises = DEFAULT_TEMPLATES.flatMap((t) =>
      t.content.weeks.flatMap((w: any) => w.days.flatMap((d: any) => d.exercises)),
    );
    const shuffled = seededShuffle(allExercises, seed).slice(0, 8);
    setShuffledWorkout({
      name: `Daily Workout — ${new Date().toLocaleDateString()}`,
      exercises: shuffled,
    });
    toast.success("Daily workout shuffled!");
  };

  const handleAssignTemplate = (template: any) => {
    setSelectedTemplate(template);
    setAssignDrawerOpen(true);
  };

  const visibleDefaults = DEFAULT_TEMPLATES.filter(
    (dt) => dt.type === planType && !templates.some((t: any) => t.name === dt.name),
  );
  const hasAnyTemplate = templates.length > 0 || visibleDefaults.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Library className="h-8 w-8 text-primary" />
              Plan Templates
            </h1>
            <p className="text-muted-foreground">
              Browse, shuffle, and assign workout & diet templates to members
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-muted/50 p-1 gap-1">
              <Button
                size="sm"
                variant={planType === "workout" ? "default" : "ghost"}
                onClick={() => setPlanType("workout")}
                className="gap-1.5"
              >
                <Dumbbell className="h-4 w-4" /> Workout
              </Button>
              <Button
                size="sm"
                variant={planType === "diet" ? "default" : "ghost"}
                onClick={() => setPlanType("diet")}
                className="gap-1.5"
              >
                <Utensils className="h-4 w-4" /> Diet
              </Button>
            </div>
            <Button variant="outline" onClick={handleQuickShuffle} className="gap-1.5">
              <Shuffle className="h-4 w-4" /> Daily Shuffle
            </Button>
          </div>
        </div>

        {/* Quick Shuffle Result */}
        {shuffledWorkout && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  {shuffledWorkout.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedTemplate({
                        name: shuffledWorkout.name,
                        type: "workout",
                        content: {
                          name: shuffledWorkout.name,
                          type: "workout",
                          weeks: [
                            {
                              week: 1,
                              days: [
                                {
                                  day: "Today",
                                  focus: "Quick Shuffle",
                                  exercises: shuffledWorkout.exercises,
                                },
                              ],
                            },
                          ],
                        },
                      });
                      setAssignDrawerOpen(true);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShuffledWorkout(null)}>
                    ✕
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {shuffledWorkout.exercises.map((ex: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-background/80 border border-border/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.sets}×{ex.reps}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates */}
        {templatesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !hasAnyTemplate ? (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center">
              <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
              <p className="text-muted-foreground mb-4">
                {canCreate
                  ? "Create plans and save them as templates."
                  : "Templates will appear here once your manager creates them."}
              </p>
              {canCreate && (
                <Button onClick={() => navigate("/fitness/create")}>
                  <Sparkles className="mr-2 h-4 w-4" /> Create First Plan
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {visibleDefaults.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Default Starter Plans
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {visibleDefaults.map((template) => (
                    <Card
                      key={template.id}
                      className="rounded-2xl hover:border-primary/30 transition-colors shadow-lg shadow-slate-200/30"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {template.description}
                            </CardDescription>
                          </div>
                          <Badge
                            className={`border text-xs ${getDifficultyColor(template.difficulty)}`}
                          >
                            {template.difficulty}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            <Dumbbell className="h-3 w-3 mr-1" />
                            {template.type}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {template.goal}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs bg-primary/5 text-primary border-primary/20"
                          >
                            Built-in
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleAssignTemplate(template)}
                        >
                          <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign to Member
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {templates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Your Saved Templates
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template: FitnessPlanTemplate) => (
                    <Card
                      key={template.id}
                      className="rounded-2xl hover:border-primary/30 transition-colors shadow-lg shadow-slate-200/30"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">
                              {template.description}
                            </CardDescription>
                          </div>
                          <Badge
                            className={`border text-xs ${getDifficultyColor(template.difficulty)}`}
                          >
                            {template.difficulty || "intermediate"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            {template.type === "workout" ? (
                              <Dumbbell className="h-3 w-3 mr-1" />
                            ) : (
                              <Utensils className="h-3 w-3 mr-1" />
                            )}
                            {template.type}
                          </Badge>
                          {template.goal && (
                            <Badge variant="secondary" className="text-xs">
                              {template.goal}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleAssignTemplate(template)}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              generatePlanPDF({
                                name: template.name,
                                type: template.type,
                                data: template.content as any,
                              })
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const path =
                                template.type === "workout"
                                  ? "/fitness/create/manual/workout"
                                  : "/fitness/create/manual/diet";
                              navigate(`${path}?template=${template.id}`);
                            }}
                            title="Use as starting point"
                          >
                            <FilePlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AssignPlanDrawer
        open={assignDrawerOpen}
        onOpenChange={setAssignDrawerOpen}
        plan={
          selectedTemplate
            ? {
                name: selectedTemplate.name,
                type: selectedTemplate.type as "workout" | "diet",
                description: selectedTemplate.description || undefined,
                content: selectedTemplate.content,
              }
            : null
        }
      />
    </AppLayout>
  );
}
