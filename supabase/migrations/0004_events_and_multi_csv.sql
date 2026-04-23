-- 0004_events_and_multi_csv.sql
-- Idempotent additive schema for the Events section and multi-format CSV
-- imports. Run manually in Supabase SQL Editor. Safe to re-run.

-- === events ===
create table if not exists events (
  luma_event_id text primary key,
  name text not null,
  event_date timestamptz,
  first_imported_at timestamptz default now(),
  last_imported_at timestamptz default now(),
  registered_count int default 0,
  approved_count int default 0,
  checked_in_count int default 0
);
create index if not exists events_date_idx on events(event_date desc);

-- === event_attendance ===
create table if not exists event_attendance (
  luma_event_id text not null references events(luma_event_id) on delete cascade,
  member_user_api_id text not null references members(user_api_id) on delete cascade,
  guest_api_id text,
  approval_status text check (approval_status in ('invited','approved','declined')),
  registered_at timestamptz,
  checked_in_at timestamptz,
  primary key (luma_event_id, member_user_api_id)
);
create index if not exists event_attendance_member_idx
  on event_attendance(member_user_api_id);
create index if not exists event_attendance_event_idx
  on event_attendance(luma_event_id);

-- === members.source ===
-- 'subscribed' = appeared in a calendar-subscribed CSV at some point
-- 'event_only' = auto-created from an event CSV, never in a subscribed CSV
alter table members add column if not exists source text
  not null default 'subscribed';

-- === luma_imports: record source format + event context + batch ===
alter table luma_imports add column if not exists source_type text;
alter table luma_imports drop constraint if exists luma_imports_source_type_check;
alter table luma_imports add constraint luma_imports_source_type_check
  check (source_type is null or source_type in ('subscribed','event'));
alter table luma_imports add column if not exists luma_event_id text;
alter table luma_imports add column if not exists luma_event_name text;
alter table luma_imports add column if not exists batch_id uuid;
create index if not exists luma_imports_batch_idx on luma_imports(batch_id);
create index if not exists luma_imports_event_idx on luma_imports(luma_event_id);
