alter table public.announcements
  add column if not exists attachment_url text,
  add column if not exists attachment_kind text,
  add column if not exists attachment_filename text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_attachment_kind_check') then
    alter table public.announcements
      add constraint announcements_attachment_kind_check
      check (attachment_kind is null or attachment_kind in ('image','document','video'));
  end if;
end $$;