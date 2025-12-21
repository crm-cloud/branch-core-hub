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
import { Sparkles, Dumbbell, Utensils, Loader2, Copy, Save } from "lucide-react";
import { useGenerateFitnessPlan } from "@/hooks/usePTPackages";

export default function AIFitnessPage() {
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

  const generatePlan = useGenerateFitnessPlan();

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
                    <Button variant="outline" size="sm" onClick={handleCopyPlan}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4" />
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
      </div>
    </AppLayout>
  );
}
