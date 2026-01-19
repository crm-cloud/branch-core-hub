import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, Dumbbell, Utensils, Loader2, Copy, Save, UserPlus, Library, Trash2 } from "lucide-react";
import { useGenerateFitnessPlan } from "@/hooks/usePTPackages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlanTemplates, createPlanTemplate, FitnessPlanTemplate } from "@/services/fitnessService";
import { AssignPlanDrawer } from "@/components/fitness/AssignPlanDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function AIFitnessPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"generate" | "templates">("generate");
  const [planType, setPlanType] = useState<"workout" | "diet">("workout");
  const [memberInfo, setMemberInfo] = useState({
    name: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    fitnessGoals: "",
    healthConditions: "",
    experience: "beginner",
    preferences: "",
  });
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [caloriesTarget, setCaloriesTarget] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FitnessPlanTemplate | null>(null);

  const generatePlan = useGenerateFitnessPlan();

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['fitness-templates', planType],
    queryFn: () => fetchPlanTemplates(undefined, planType),
  });

  // Save as template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: createPlanTemplate,
    onSuccess: () => {
      toast.success("Template saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save template");
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('fitness_plan_templates')
        .update({ is_active: false })
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
    },
  });

  const handleGenerate = async () => {
    if (!memberInfo.name) {
      toast.error("Please enter member name");
      return;
    }

    try {
      const plan = await generatePlan.mutateAsync({
        type: planType,
        memberInfo: {
          name: memberInfo.name,
          age: memberInfo.age ? parseInt(memberInfo.age) : undefined,
          gender: memberInfo.gender || undefined,
          height: memberInfo.height ? parseFloat(memberInfo.height) : undefined,
          weight: memberInfo.weight ? parseFloat(memberInfo.weight) : undefined,
          fitnessGoals: memberInfo.fitnessGoals || undefined,
          healthConditions: memberInfo.healthConditions || undefined,
          experience: memberInfo.experience || undefined,
          preferences: memberInfo.preferences || undefined,
        },
        options: {
          durationWeeks,
          caloriesTarget: caloriesTarget ? parseInt(caloriesTarget) : undefined,
        },
      });
      setGeneratedPlan(plan);
      toast.success("Plan generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate plan");
    }
  };

  const handleCopyPlan = () => {
    if (generatedPlan) {
      navigator.clipboard.writeText(JSON.stringify(generatedPlan, null, 2));
      toast.success("Plan copied to clipboard");
    }
  };

  const handleSaveTemplate = () => {
    if (!generatedPlan) return;

    saveTemplateMutation.mutate({
      name: generatedPlan.name || `${planType} Plan - ${new Date().toLocaleDateString()}`,
      type: planType,
      description: generatedPlan.description,
      difficulty: generatedPlan.difficulty || 'intermediate',
      goal: generatedPlan.goal,
      content: generatedPlan,
      is_public: true,
    });
  };

  const handleAssignGeneratedPlan = () => {
    if (!generatedPlan) return;
    setSelectedTemplate(null);
    setAssignDrawerOpen(true);
  };

  const handleAssignTemplate = (template: FitnessPlanTemplate) => {
    setSelectedTemplate(template);
    setAssignDrawerOpen(true);
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner': return 'bg-success/20 text-success';
      case 'intermediate': return 'bg-warning/20 text-warning';
      case 'advanced': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              AI Fitness Planner
            </h1>
            <p className="text-muted-foreground">Generate personalized workout and diet plans with AI</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "generate" | "templates")}>
          <TabsList>
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Plan
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Library className="h-4 w-4" />
              Plan Templates
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Member Information</CardTitle>
                  <CardDescription>Enter member details to generate a personalized plan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs value={planType} onValueChange={(v) => setPlanType(v as "workout" | "diet")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="workout" className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        Workout Plan
                      </TabsTrigger>
                      <TabsTrigger value="diet" className="flex items-center gap-2">
                        <Utensils className="h-4 w-4" />
                        Diet Plan
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Member Name *</Label>
                      <Input
                        value={memberInfo.name}
                        onChange={(e) => setMemberInfo({ ...memberInfo, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Age</Label>
                        <Input
                          type="number"
                          value={memberInfo.age}
                          onChange={(e) => setMemberInfo({ ...memberInfo, age: e.target.value })}
                          placeholder="25"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Gender</Label>
                        <Select
                          value={memberInfo.gender}
                          onValueChange={(v) => setMemberInfo({ ...memberInfo, gender: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Experience</Label>
                        <Select
                          value={memberInfo.experience}
                          onValueChange={(v) => setMemberInfo({ ...memberInfo, experience: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Height (cm)</Label>
                        <Input
                          type="number"
                          value={memberInfo.height}
                          onChange={(e) => setMemberInfo({ ...memberInfo, height: e.target.value })}
                          placeholder="175"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Weight (kg)</Label>
                        <Input
                          type="number"
                          value={memberInfo.weight}
                          onChange={(e) => setMemberInfo({ ...memberInfo, weight: e.target.value })}
                          placeholder="70"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Fitness Goals</Label>
                      <Textarea
                        value={memberInfo.fitnessGoals}
                        onChange={(e) => setMemberInfo({ ...memberInfo, fitnessGoals: e.target.value })}
                        placeholder="Lose weight, build muscle, improve endurance..."
                        rows={2}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Health Conditions</Label>
                      <Input
                        value={memberInfo.healthConditions}
                        onChange={(e) => setMemberInfo({ ...memberInfo, healthConditions: e.target.value })}
                        placeholder="Any injuries, conditions, or limitations..."
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Preferences</Label>
                      <Input
                        value={memberInfo.preferences}
                        onChange={(e) => setMemberInfo({ ...memberInfo, preferences: e.target.value })}
                        placeholder={planType === "workout" ? "Home workouts, no equipment..." : "Vegetarian, no dairy..."}
                      />
                    </div>

                    {planType === "workout" ? (
                      <div className="grid gap-2">
                        <Label>Duration (weeks)</Label>
                        <Input
                          type="number"
                          value={durationWeeks}
                          onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)}
                        />
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <Label>Target Calories (optional)</Label>
                        <Input
                          type="number"
                          value={caloriesTarget}
                          onChange={(e) => setCaloriesTarget(e.target.value)}
                          placeholder="Auto-calculate based on goals"
                        />
                      </div>
                    )}

                    <Button onClick={handleGenerate} disabled={generatePlan.isPending} className="w-full">
                      {generatePlan.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate {planType === "workout" ? "Workout" : "Diet"} Plan
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Generated Plan */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Generated Plan</CardTitle>
                      <CardDescription>
                        {generatedPlan ? generatedPlan.name : "Your AI-generated plan will appear here"}
                      </CardDescription>
                    </div>
                    {generatedPlan && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopyPlan} title="Copy">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleSaveTemplate}
                          disabled={saveTemplateMutation.isPending}
                          title="Save as Template"
                        >
                          {saveTemplateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleAssignGeneratedPlan}
                          title="Assign to Member"
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!generatedPlan ? (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      Fill in member details and click Generate
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        {/* Plan Header */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge>{generatedPlan.difficulty || generatedPlan.type}</Badge>
                            {generatedPlan.goal && <Badge variant="outline">{generatedPlan.goal}</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">{generatedPlan.description}</p>
                        </div>

                        {/* Workout Plan */}
                        {planType === "workout" && generatedPlan.weeks && (
                          <div className="space-y-4">
                            {generatedPlan.weeks.map((week: any, weekIdx: number) => (
                              <div key={weekIdx} className="space-y-2">
                                <h4 className="font-semibold">Week {week.week}</h4>
                                {week.days?.map((day: any, dayIdx: number) => (
                                  <Card key={dayIdx} className="p-3">
                                    <div className="font-medium text-sm">{day.day} - {day.focus}</div>
                                    {day.warmup && (
                                      <p className="text-xs text-muted-foreground">Warmup: {day.warmup}</p>
                                    )}
                                    <div className="mt-2 space-y-1">
                                      {day.exercises?.map((ex: any, exIdx: number) => (
                                        <div key={exIdx} className="text-sm flex justify-between">
                                          <span>{ex.name}</span>
                                          <span className="text-muted-foreground">
                                            {ex.sets}x{ex.reps} ({ex.rest})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Diet Plan */}
                        {planType === "diet" && generatedPlan.meals && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4 text-sm">
                              <span>Daily Calories: <strong>{generatedPlan.dailyCalories}</strong></span>
                              {generatedPlan.macros && (
                                <span>
                                  P: {generatedPlan.macros.protein} | C: {generatedPlan.macros.carbs} | F: {generatedPlan.macros.fat}
                                </span>
                              )}
                            </div>
                            {generatedPlan.meals.map((day: any, dayIdx: number) => (
                              <Card key={dayIdx} className="p-3">
                                <div className="font-medium text-sm mb-2">{day.day}</div>
                                <div className="space-y-1 text-sm">
                                  {day.breakfast && (
                                    <div className="flex justify-between">
                                      <span>🌅 {day.breakfast.meal}</span>
                                      <span className="text-muted-foreground">{day.breakfast.calories} cal</span>
                                    </div>
                                  )}
                                  {day.snack1 && (
                                    <div className="flex justify-between">
                                      <span>🍎 {day.snack1.meal}</span>
                                      <span className="text-muted-foreground">{day.snack1.calories} cal</span>
                                    </div>
                                  )}
                                  {day.lunch && (
                                    <div className="flex justify-between">
                                      <span>🍽️ {day.lunch.meal}</span>
                                      <span className="text-muted-foreground">{day.lunch.calories} cal</span>
                                    </div>
                                  )}
                                  {day.snack2 && (
                                    <div className="flex justify-between">
                                      <span>🥜 {day.snack2.meal}</span>
                                      <span className="text-muted-foreground">{day.snack2.calories} cal</span>
                                    </div>
                                  )}
                                  {day.dinner && (
                                    <div className="flex justify-between">
                                      <span>🌙 {day.dinner.meal}</span>
                                      <span className="text-muted-foreground">{day.dinner.calories} cal</span>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                            {generatedPlan.notes && (
                              <p className="text-sm text-muted-foreground mt-4">{generatedPlan.notes}</p>
                            )}
                          </div>
                        )}

                        {/* General notes */}
                        {generatedPlan.notes && planType === "workout" && (
                          <div className="mt-4 p-3 bg-muted rounded-lg">
                            <p className="text-sm">{generatedPlan.notes}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <Tabs value={planType} onValueChange={(v) => setPlanType(v as "workout" | "diet")}>
                <TabsList>
                  <TabsTrigger value="workout">Workout</TabsTrigger>
                  <TabsTrigger value="diet">Diet</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {templatesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate plans using AI and save them as templates to use later.
                  </p>
                  <Button onClick={() => setActiveTab("generate")}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate First Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <Card key={template.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </div>
                        <Badge className={getDifficultyColor(template.difficulty)}>
                          {template.difficulty || 'intermediate'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 mb-4">
                        <Badge variant="outline">
                          {template.type === 'workout' ? <Dumbbell className="h-3 w-3 mr-1" /> : <Utensils className="h-3 w-3 mr-1" />}
                          {template.type}
                        </Badge>
                        {template.goal && <Badge variant="secondary">{template.goal}</Badge>}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => handleAssignTemplate(template)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign Plan Drawer */}
      <AssignPlanDrawer
        open={assignDrawerOpen}
        onOpenChange={setAssignDrawerOpen}
        plan={selectedTemplate ? {
          name: selectedTemplate.name,
          type: selectedTemplate.type as 'workout' | 'diet',
          description: selectedTemplate.description || undefined,
          content: selectedTemplate.content,
        } : generatedPlan ? {
          name: generatedPlan.name || `${planType} Plan`,
          type: planType,
          description: generatedPlan.description,
          content: generatedPlan,
        } : null}
      />
    </AppLayout>
  );
}
