
-- Tighten lead nurture cron to business hours only (was every hour 24/7).
UPDATE public.automation_rules
SET cron_expression = '0 9-21 * * *'
WHERE key = 'lead_nurture_followup' AND branch_id IS NULL;

-- Note: birthday_wish at '30 9 * * *' fires once a day; runBirthdayWish()
-- additionally dedupes via dispatch-communication using
-- dedupe_key='birthday_wish:{member}:{YYYY-MM-DD}', so a member can never
-- receive more than one wish per day even if the brain ticks multiple times
-- before next_run_at advances.
