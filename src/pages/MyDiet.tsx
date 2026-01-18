import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMemberData } from '@/hooks/useMemberData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UtensilsCrossed, Calendar, AlertCircle, User, Clock, Flame, Apple, Beef } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function MyDiet() {
  const { profile } = useAuth();
  const { member, isLoading: memberLoading } = useMemberData();

  // Fetch active diet plan
  const { data: dietPlan, isLoading: planLoading } = useQuery({
    queryKey: ['my-diet-plan', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select(`
          *,
          trainer:trainer_id(user_id, profiles:user_id(full_name))
        `)
        .eq('member_id', member!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const isLoading = memberLoading || planLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
          <p className="text-muted-foreground">Your account is not linked to a member profile.</p>
        </div>
      </AppLayout>
    );
  }

  // Parse diet plan data
  const planData = dietPlan?.plan_data as {
    meals?: Array<{
      time: string;
      name: string;
      items: string[];
      calories?: number;
      protein?: number;
      carbs?: number;
      fats?: number;
    }>;
    notes?: string;
  } | null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UtensilsCrossed className="h-8 w-8 text-success" />
              My Diet Plan
            </h1>
            <p className="text-muted-foreground">
              Your personalized nutrition guide
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/my-requests">Request New Plan</Link>
          </Button>
        </div>

        {dietPlan ? (
          <>
            {/* Plan Info */}
            <Card className="border-success/20 bg-success/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5" />
                    {dietPlan.name}
                  </CardTitle>
                  <Badge variant="default" className="bg-success">Active</Badge>
                </div>
                {dietPlan.description && (
                  <CardDescription>{dietPlan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-warning/10">
                      <Flame className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Daily Calories</p>
                      <p className="font-bold text-lg">{dietPlan.calories_target || 'N/A'} kcal</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{dietPlan.start_date ? format(new Date(dietPlan.start_date), 'dd MMM yyyy') : 'N/A'}</p>
                    </div>
                  </div>
                  {dietPlan.end_date && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">End Date</p>
                        <p className="font-medium">{format(new Date(dietPlan.end_date), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                  )}
                  {dietPlan.trainer && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Trainer</p>
                        <p className="font-medium">{(dietPlan.trainer as any)?.profiles?.full_name || 'Assigned Trainer'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Meal Schedule */}
            {planData?.meals && planData.meals.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Daily Meal Schedule</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {planData.meals.map((meal, index) => (
                    <Card key={index} className="border-border/50">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <UtensilsCrossed className="h-5 w-5 text-accent" />
                            {meal.name}
                          </CardTitle>
                          <Badge variant="outline">{meal.time}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <ul className="space-y-1">
                            {meal.items.map((item, itemIndex) => (
                              <li key={itemIndex} className="text-sm flex items-center gap-2">
                                <span className="text-success">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                          {(meal.calories || meal.protein || meal.carbs || meal.fats) && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                              {meal.calories && (
                                <Badge variant="secondary" className="text-xs">
                                  <Flame className="h-3 w-3 mr-1" />{meal.calories} kcal
                                </Badge>
                              )}
                              {meal.protein && (
                                <Badge variant="secondary" className="text-xs">
                                  <Beef className="h-3 w-3 mr-1" />{meal.protein}g protein
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Meal details are being prepared by your trainer.</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {planData?.notes && (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Additional Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{planData.notes}</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Active Diet Plan</h3>
              <p className="text-muted-foreground mb-6">
                You don't have a personalized diet plan yet. Request one from your trainer!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild>
                  <Link to="/my-requests">Request Diet Plan</Link>
                </Button>
                {member.assigned_trainer && (
                  <Button variant="outline" asChild>
                    <Link to="/my-pt-sessions">Book PT Session</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nutrition Tips */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">🥗 Nutrition Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Eat 5-6 small meals throughout the day</li>
              <li>• Drink at least 8 glasses of water daily</li>
              <li>• Include protein in every meal</li>
              <li>• Avoid processed foods and sugary drinks</li>
              <li>• Eat your last meal 2-3 hours before sleeping</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
