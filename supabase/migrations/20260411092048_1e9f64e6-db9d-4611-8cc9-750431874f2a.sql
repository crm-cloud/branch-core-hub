
-- 1. Create whatsapp_triggers table
CREATE TABLE public.whatsapp_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE CASCADE,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, event_name)
);

ALTER TABLE public.whatsapp_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp triggers"
  ON public.whatsapp_triggers FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE TRIGGER update_whatsapp_triggers_updated_at
  BEFORE UPDATE ON public.whatsapp_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Delete all existing templates
DELETE FROM public.templates;

-- 3. Insert comprehensive templates (no category column — it doesn't exist)
INSERT INTO public.templates (name, type, content, variables, meta_template_name) VALUES
-- WhatsApp: Welcome
('New Member Welcome', 'whatsapp',
 'Welcome to Incline Fitness, {{1}}! 🏋️ Your membership ({{2}}) is active until {{3}}. Member ID: {{4}}. We''re excited to have you! Visit us anytime — our team is here to support your fitness journey.',
 '["member_name","plan_name","end_date","member_code"]'::jsonb, 'new_member_welcome'),

('Trial Day Welcome', 'whatsapp',
 'Hi {{1}}! Welcome to your trial day at Incline Fitness 🎉 We''ve prepared everything for you. Our trainer {{2}} will guide you through your session. Enjoy!',
 '["name","trainer_name"]'::jsonb, 'trial_day_welcome'),

-- WhatsApp: Payments
('Payment Received', 'whatsapp',
 'Hi {{1}}, your payment of ₹{{2}} has been received ✅ Invoice: {{3}}. Date: {{4}}. Thank you for staying active with Incline Fitness! 💪',
 '["member_name","amount","invoice_number","date"]'::jsonb, 'payment_received'),

('Payment Reminder', 'whatsapp',
 'Hi {{1}}, you have a pending payment of ₹{{2}} at Incline Fitness. Invoice: {{3}}. Due date: {{4}}. Please clear the dues at your earliest convenience.',
 '["member_name","amount","invoice_number","due_date"]'::jsonb, 'payment_reminder'),

('Payment Overdue', 'whatsapp',
 'Hi {{1}}, your payment of ₹{{2}} is overdue. Invoice: {{3}}. Please settle your dues immediately to avoid service interruption. Contact us if you need help.',
 '["member_name","amount","invoice_number"]'::jsonb, 'payment_overdue'),

('Refund Processed', 'whatsapp',
 'Hi {{1}}, your refund of ₹{{2}} has been processed. Reference: {{3}}. It should reflect in your account within 5-7 business days.',
 '["member_name","amount","reference_id"]'::jsonb, 'refund_processed'),

-- WhatsApp: Invoices
('Invoice Share', 'whatsapp',
 'Hi {{1}}, here''s your invoice from Incline Fitness. Invoice #: {{2}}. Amount: ₹{{3}}. Due: {{4}}. You can view and pay online or visit us at the gym.',
 '["member_name","invoice_number","amount","due_date"]'::jsonb, 'invoice_share'),

('Invoice Reminder', 'whatsapp',
 'Reminder: Hi {{1}}, invoice {{2}} for ₹{{3}} is due on {{4}}. Please make the payment to avoid late fees. Reply if you have questions.',
 '["member_name","invoice_number","amount","due_date"]'::jsonb, 'invoice_reminder'),

-- WhatsApp: Membership
('Renewal Reminder 7 Days', 'whatsapp',
 '⏰ Hi {{1}}, your Incline Fitness membership ({{2}}) expires in 7 days on {{3}}. Renew now to keep your streak going! Reply to renew or visit us. 💪',
 '["member_name","plan_name","end_date"]'::jsonb, 'renewal_reminder_7d'),

('Renewal Reminder 1 Day', 'whatsapp',
 '🚨 Hi {{1}}, your membership expires TOMORROW ({{2}})! Don''t miss a single workout. Renew today and get exclusive renewal benefits. Visit us or reply now.',
 '["member_name","end_date"]'::jsonb, 'renewal_reminder_1d'),

('Membership Expired', 'whatsapp',
 'Hi {{1}}, your Incline Fitness membership has expired on {{2}}. We miss you at the gym! Rejoin now and get special comeback offers. Reply to know more.',
 '["member_name","end_date"]'::jsonb, 'membership_expired'),

('Freeze Confirmation', 'whatsapp',
 'Hi {{1}}, your membership has been frozen ❄️ Freeze period: {{2}} to {{3}}. Your membership will automatically resume after the freeze period ends.',
 '["member_name","freeze_start","freeze_end"]'::jsonb, 'freeze_confirmation'),

('Unfreeze Confirmation', 'whatsapp',
 'Hi {{1}}, your membership has been unfrozen and is now active ✅ Valid until: {{2}}. Welcome back — see you at the gym! 💪',
 '["member_name","new_end_date"]'::jsonb, 'unfreeze_confirmation'),

-- WhatsApp: Classes
('Class Booking Confirmed', 'whatsapp',
 '✅ Class Booked! Hi {{1}}, you''re registered for {{2}} on {{3}} at {{4}} with trainer {{5}}. Please arrive 10 mins early. See you there! 🏃',
 '["member_name","class_name","date","time","trainer_name"]'::jsonb, 'class_booking_confirmed'),

('Class Booking Cancelled', 'whatsapp',
 'Hi {{1}}, your booking for {{2}} on {{3}} has been cancelled. You can rebook anytime from our app or visit the front desk.',
 '["member_name","class_name","date"]'::jsonb, 'class_booking_cancelled'),

('Class Reminder', 'whatsapp',
 '🔔 Reminder: Hi {{1}}, your {{2}} class starts in 1 hour at {{3}}! Trainer: {{4}}. Get ready and arrive a few minutes early. 🏋️',
 '["member_name","class_name","time","trainer_name"]'::jsonb, 'class_reminder'),

-- WhatsApp: Facilities
('Sauna Booking Confirmed', 'whatsapp',
 '🧖 Sauna Booked! Hi {{1}}, your sauna session is confirmed for {{2}} from {{3}} to {{4}}. Please arrive on time. Enjoy your session!',
 '["member_name","date","start_time","end_time"]'::jsonb, 'sauna_booking_confirmed'),

('Ice Bath Booking Confirmed', 'whatsapp',
 '🧊 Ice Bath Booked! Hi {{1}}, your ice bath session is confirmed for {{2}} from {{3}} to {{4}}. Bring a towel and enjoy the recovery!',
 '["member_name","date","start_time","end_time"]'::jsonb, 'ice_bath_booking_confirmed'),

('Facility Slot Reminder', 'whatsapp',
 '🔔 Reminder: Hi {{1}}, your {{2}} session is in 30 minutes — {{3}} at {{4}}. Please be ready!',
 '["member_name","facility_name","date","time"]'::jsonb, 'facility_slot_reminder'),

-- WhatsApp: PT
('PT Session Booked', 'whatsapp',
 '💪 PT Session Booked! Hi {{1}}, your personal training session with {{2}} is confirmed for {{3}} at {{4}}. Get ready for an amazing workout!',
 '["member_name","trainer_name","date","time"]'::jsonb, 'pt_session_booked'),

('PT Session Reminder', 'whatsapp',
 '🔔 Hi {{1}}, your PT session with {{2}} starts in 1 hour at {{3}}. Don''t forget your water bottle and towel!',
 '["member_name","trainer_name","time"]'::jsonb, 'pt_session_reminder'),

('PT Pack Expiring', 'whatsapp',
 'Hi {{1}}, your PT package ({{2}}) has {{3}} sessions remaining and expires on {{4}}. Book your sessions now to use them all! Reply to schedule.',
 '["member_name","package_name","remaining_sessions","expiry_date"]'::jsonb, 'pt_pack_expiring'),

-- WhatsApp: Leads
('Lead Welcome', 'whatsapp',
 'Hi {{1}}! 👋 Thanks for your interest in Incline Fitness! We''d love to show you around. Would you like to schedule a free gym tour? Reply with your preferred time!',
 '["name"]'::jsonb, 'lead_welcome'),

('Lead Follow-up', 'whatsapp',
 'Hi {{1}}! Just checking in from Incline Fitness 🏋️ We''d love to help you start your fitness journey. Our current offer: {{2}}. Want to know more? Reply anytime!',
 '["name","current_offer"]'::jsonb, 'lead_followup'),

('Lead Special Offer', 'whatsapp',
 '🔥 Hi {{1}}! Exclusive offer just for you at Incline Fitness: {{2}}. Valid till {{3}}. Don''t miss out — reply YES to claim or visit us today!',
 '["name","offer_details","valid_till"]'::jsonb, 'lead_special_offer'),

-- WhatsApp: General
('Birthday Wish', 'whatsapp',
 '🎂 Happy Birthday, {{1}}! 🎉 Wishing you a year of health, happiness & personal bests! Here''s a gift from us: {{2}}. From your Incline Fitness Family 🏋️',
 '["member_name","gift_details"]'::jsonb, 'birthday_wish'),

('Referral Reward', 'whatsapp',
 '🎁 Congrats {{1}}! Your referral {{2}} just joined Incline Fitness! Your reward: {{3}} has been credited. Keep referring! 💪',
 '["member_name","referee_name","reward_details"]'::jsonb, 'referral_reward'),

('Missed Workout Nudge', 'whatsapp',
 '👋 Hey {{1}}! We noticed you haven''t visited in {{2}} days. Consistency is key! Even a 30-min session counts. See you soon? 💪',
 '["member_name","days_absent"]'::jsonb, 'missed_workout_nudge'),

('Feedback Request', 'whatsapp',
 'Hi {{1}}! We''d love to hear from you 🙏 How was your experience at Incline Fitness? Rate us 1-5 or share your thoughts. Your feedback helps us improve!',
 '["member_name"]'::jsonb, 'feedback_request'),

-- Email templates
('Welcome Email', 'email',
 'Dear {{name}},\n\nWelcome to Incline Fitness! We''re thrilled to have you join our community.\n\nYour details:\n• Member ID: {{member_code}}\n• Plan: {{plan_name}}\n• Valid until: {{end_date}}\n\nEnjoy our equipment, classes, sauna, ice bath & personal training!\n\nBest regards,\nIncline Fitness',
 '["name","member_code","plan_name","end_date"]'::jsonb, NULL),

('Payment Receipt Email', 'email',
 'Dear {{name}},\n\nPayment of ₹{{amount}} received.\nInvoice: {{invoice_number}}\nDate: {{date}}\n\nThank you!\nIncline Fitness',
 '["name","amount","invoice_number","date"]'::jsonb, NULL),

('Payment Reminder Email', 'email',
 'Dear {{name}},\n\nPending payment of ₹{{amount}}.\nInvoice: {{invoice_number}}\nDue: {{due_date}}\n\nPlease settle your dues.\n\nIncline Fitness',
 '["name","amount","invoice_number","due_date"]'::jsonb, NULL),

('Renewal Reminder Email', 'email',
 'Dear {{name}},\n\nYour membership ({{plan_name}}) expires on {{end_date}}. Renew now for uninterrupted access!\n\nIncline Fitness',
 '["name","plan_name","end_date"]'::jsonb, NULL),

('Class Booking Email', 'email',
 'Dear {{name}},\n\nClass booking confirmed!\nClass: {{class_name}}\nDate: {{date}}\nTime: {{time}}\nTrainer: {{trainer_name}}\n\nSee you!\nIncline Fitness',
 '["name","class_name","date","time","trainer_name"]'::jsonb, NULL),

('Facility Booking Email', 'email',
 'Dear {{name}},\n\nYour {{facility_name}} booking is confirmed!\nDate: {{date}}\nTime: {{start_time}} - {{end_time}}\n\nEnjoy!\nIncline Fitness',
 '["name","facility_name","date","start_time","end_time"]'::jsonb, NULL),

('PT Session Email', 'email',
 'Dear {{name}},\n\nPT session scheduled!\nTrainer: {{trainer_name}}\nDate: {{date}}\nTime: {{time}}\n\nSee you there!\nIncline Fitness',
 '["name","trainer_name","date","time"]'::jsonb, NULL),

('Birthday Email', 'email',
 'Dear {{name}},\n\n🎂 Happy Birthday!\n\nGift: {{gift_details}}\n\nHave a wonderful day!\nIncline Fitness',
 '["name","gift_details"]'::jsonb, NULL),

('Feedback Request Email', 'email',
 'Dear {{name}},\n\nWe''d love your feedback on Incline Fitness! Reply with your thoughts.\n\nThank you!\nIncline Fitness',
 '["name"]'::jsonb, NULL),

-- SMS templates
('Payment Reminder SMS', 'sms',
 'Hi {{name}}, pending payment of ₹{{amount}} at Incline Fitness. Invoice: {{invoice_number}}. Due: {{due_date}}. Please clear dues.',
 '["name","amount","invoice_number","due_date"]'::jsonb, NULL),

('Membership Expiry SMS', 'sms',
 'Hi {{name}}, your Incline Fitness membership expires on {{end_date}}. Renew now! Visit us or call for options.',
 '["name","end_date"]'::jsonb, NULL),

('Class Reminder SMS', 'sms',
 'Hi {{name}}, your {{class_name}} class starts at {{time}} today. Trainer: {{trainer_name}}. Arrive 10 mins early. - Incline Fitness',
 '["name","class_name","time","trainer_name"]'::jsonb, NULL),

('Birthday SMS', 'sms',
 'Happy Birthday {{name}}! 🎂 Incline Fitness wishes you health & fitness. Visit today for your birthday surprise!',
 '["name"]'::jsonb, NULL),

('Trial Follow-up SMS', 'sms',
 'Hi {{name}}! How was your trial at Incline Fitness? Sign up today for a special offer! Call us or visit.',
 '["name"]'::jsonb, NULL);
