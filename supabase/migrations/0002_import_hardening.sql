-- 0002_import_hardening.sql
-- Idempotent additive schema changes for CSV import hardening.
-- Run manually in Supabase SQL Editor. Safe to re-run.

-- luma_imports: add new columns. Keep existing uploaded_by/uploaded_at/
-- storage_path/status for back-compat. The existing primary key `id`
-- continues to serve as the "import_id" referenced by member_edits.
alter table luma_imports add column if not exists filename text;
alter table luma_imports add column if not exists file_size_bytes int;
alter table luma_imports add column if not exists unchanged_count int;
alter table luma_imports add column if not exists header_mapping jsonb;
alter table luma_imports add column if not exists unmapped_headers text[];
alter table luma_imports add column if not exists errors jsonb;
alter table luma_imports add column if not exists dry_run boolean not null default false;

-- member_edits: evolve the existing per-field log to also capture source
-- and the triggering import. Existing rows default to source='manual'.
alter table member_edits add column if not exists import_id uuid
  references luma_imports(id) on delete set null;
alter table member_edits add column if not exists source text not null
  default 'manual';
alter table member_edits add column if not exists changed_by text;

-- Guard source values. Dropped-then-recreated so re-runs are idempotent.
alter table member_edits drop constraint if exists member_edits_source_check;
alter table member_edits add constraint member_edits_source_check
  check (source in ('import','manual'));

create index if not exists member_edits_import_idx on member_edits(import_id);

-- Normalized-email generated columns for reliable matching/joins.
alter table members add column if not exists email_normalized text
  generated always as (lower(trim(email))) stored;
create index if not exists members_email_norm_idx on members(email_normalized);

alter table blacklist add column if not exists email_normalized text
  generated always as (lower(trim(email))) stored;
create index if not exists blacklist_email_norm_idx on blacklist(email_normalized);

-- Index for analytics / history queries.
create index if not exists members_first_seen_idx on members(first_seen);
