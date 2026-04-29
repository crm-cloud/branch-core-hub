create table if not exists public.scan_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null,
  kind text not null check (kind in ('body','posture')),
  member_id uuid,
  branch_id uuid,
  pdf_url text,
  email_status text,
  email_error text,
  whatsapp_status text,
  whatsapp_error text,
  inapp_status text,
  created_at timestamptz not null default now(),
  unique (report_id, kind)
);

create index if not exists idx_scan_deliveries_member on public.scan_report_deliveries(member_id);
create index if not exists idx_scan_deliveries_branch on public.scan_report_deliveries(branch_id);

alter table public.scan_report_deliveries enable row level security;

create policy "Staff can view scan deliveries"
  on public.scan_report_deliveries
  for select
  to authenticated
  using (has_any_role(auth.uid(), array['owner'::app_role,'admin'::app_role,'manager'::app_role,'staff'::app_role]));
