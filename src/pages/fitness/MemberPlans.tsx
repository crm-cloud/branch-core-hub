import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Library, Users } from "lucide-react";
import { FitnessHubTabs } from "@/components/fitness/FitnessHubTabs";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function FitnessMemberPlansPage() {
  const navigate = useNavigate();

  const { data: memberPlans = [], isLoading } = useQuery({
    queryKey: ["member-fitness-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diet_plans")
        .select(
          "id, name, description, plan_type, start_date, end_date, is_active, member_id, members:member_id(member_code, user_id, profiles:user_id(full_name, avatar_url))",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <FitnessHubTabs />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Member Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Workout & diet plans currently assigned to members
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : memberPlans.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Member Plans Assigned</h3>
              <p className="text-muted-foreground mb-4">
                Assign plans to members from the Template Library or create a new one.
              </p>
              <Button onClick={() => navigate("/fitness/templates")}>
                <Library className="mr-2 h-4 w-4" /> Browse Templates
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {memberPlans.map((plan: any) => {
              const memberProfile = plan.members?.profiles;
              return (
                <Card key={plan.id} className="rounded-2xl shadow-lg shadow-slate-200/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={memberProfile?.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {memberProfile?.full_name?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-sm">
                            {memberProfile?.full_name || "Unknown"}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {plan.members?.member_code}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={plan.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {plan.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium text-sm mb-1">{plan.name}</p>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {plan.plan_type || "workout"}
                      </Badge>
                      {plan.start_date && (
                        <span>From {format(new Date(plan.start_date), "dd MMM yyyy")}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
