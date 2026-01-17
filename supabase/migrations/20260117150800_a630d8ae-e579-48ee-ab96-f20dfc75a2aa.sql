-- Add visibility control for member dashboard
ALTER TABLE membership_plans 
ADD COLUMN IF NOT EXISTS is_visible_to_members boolean DEFAULT true;

-- Add membership period type to plan_benefits for period-aware benefit tracking
ALTER TABLE plan_benefits 
ADD COLUMN IF NOT EXISTS reset_period text DEFAULT 'per_membership' 
CHECK (reset_period IN ('per_membership', 'per_month', 'per_week', 'per_day'));

-- Add comment for clarity
COMMENT ON COLUMN membership_plans.is_visible_to_members IS 'Controls whether this plan is shown on member dashboard for self-purchase';
COMMENT ON COLUMN plan_benefits.reset_period IS 'Defines when benefit usage counter resets: per_membership (never), per_month, per_week, per_day';