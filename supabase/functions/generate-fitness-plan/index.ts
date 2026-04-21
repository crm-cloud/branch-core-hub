import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const serve = Deno.serve;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_AI_ROLES = ["owner", "admin", "manager"] as const;

interface GeneratePlanRequest {
  type: "workout" | "diet";
  memberInfo: {
    name?: string;
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    fitnessGoals?: string;
    healthConditions?: string;
    experience?: string;
    preferences?: string;
  };
  durationWeeks?: number;
  caloriesTarget?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Server-side role check: only owner/admin/manager may generate AI plans ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ALLOWED_AI_ROLES as unknown as string[]);

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden: AI plan generation requires owner, admin, or manager role." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { type, memberInfo, durationWeeks = 4, caloriesTarget } = await req.json() as GeneratePlanRequest;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = type === "workout" 
      ? `You are an expert fitness trainer creating personalized workout plans. Generate detailed, safe, and effective workout programs.
         Return a JSON object with the following structure:
         {
           "name": "Plan name",
           "description": "Brief description",
           "goal": "Primary goal",
           "difficulty": "beginner|intermediate|advanced",
           "weeks": [
             {
               "week": 1,
               "days": [
                 {
                   "day": "Monday",
                   "focus": "Chest & Triceps",
                   "exercises": [
                     {"name": "Bench Press", "sets": 4, "reps": "8-10", "rest": "90s", "notes": "Focus on form"}
                   ],
                   "warmup": "5 min cardio + dynamic stretches",
                   "cooldown": "5 min stretching"
                 }
               ]
             }
           ],
           "notes": "General advice and precautions"
         }`
      : `You are an expert nutritionist creating personalized diet plans. Generate detailed, balanced, and practical meal plans.
         Return a JSON object with the following structure:
         {
           "name": "Diet plan name",
           "description": "Brief description",
           "type": "weight_loss|muscle_gain|maintenance|general_health",
           "dailyCalories": 2000,
           "macros": {"protein": "30%", "carbs": "40%", "fat": "30%"},
           "meals": [
             {
               "day": "Monday",
               "breakfast": {"meal": "Oatmeal with berries", "calories": 350, "protein": 12, "carbs": 55, "fat": 8},
               "snack1": {"meal": "Greek yogurt", "calories": 150},
               "lunch": {"meal": "Grilled chicken salad", "calories": 450},
               "snack2": {"meal": "Almonds", "calories": 160},
               "dinner": {"meal": "Salmon with vegetables", "calories": 550}
             }
           ],
           "hydration": "8-10 glasses of water daily",
           "supplements": ["Multivitamin", "Omega-3"],
           "notes": "General dietary advice"
         }`;

    const userPrompt = type === "workout"
      ? `Create a ${durationWeeks}-week workout plan for:
         - Name: ${memberInfo.name || "Member"}
         - Age: ${memberInfo.age || "Not specified"}
         - Gender: ${memberInfo.gender || "Not specified"}
         - Height: ${memberInfo.height ? memberInfo.height + " cm" : "Not specified"}
         - Weight: ${memberInfo.weight ? memberInfo.weight + " kg" : "Not specified"}
         - Fitness Goals: ${memberInfo.fitnessGoals || "General fitness"}
         - Health Conditions: ${memberInfo.healthConditions || "None reported"}
         - Experience Level: ${memberInfo.experience || "Beginner"}
         - Preferences: ${memberInfo.preferences || "None"}
         
         Create a progressive, balanced workout plan suitable for their level.`
      : `Create a weekly meal plan for:
         - Name: ${memberInfo.name || "Member"}
         - Age: ${memberInfo.age || "Not specified"}
         - Gender: ${memberInfo.gender || "Not specified"}
         - Height: ${memberInfo.height ? memberInfo.height + " cm" : "Not specified"}
         - Weight: ${memberInfo.weight ? memberInfo.weight + " kg" : "Not specified"}
         - Fitness Goals: ${memberInfo.fitnessGoals || "General health"}
         - Health Conditions: ${memberInfo.healthConditions || "None reported"}
         - Target Calories: ${caloriesTarget || "Calculate based on goals"}
         - Preferences: ${memberInfo.preferences || "None"}
         
         Create a balanced, practical meal plan suitable for their goals.`;

    console.log(`Generating ${type} plan for member:`, memberInfo.name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let plan;
    try {
      plan = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    console.log(`Successfully generated ${type} plan:`, plan.name);

    return new Response(
      JSON.stringify({ success: true, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating fitness plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
