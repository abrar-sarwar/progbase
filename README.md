# progbase

Internal dashboard for progsu — a Georgia State University club. Shows Luma
members, lets VPs fill in demographic/contact fields, runs attendance
analytics, and maintains a blacklist. Not member-facing.

## Setup

1. Clone and install:
   ```bash
   git clone <this-repo> progbase
   cd progbase
   npm install
   ```

2. Copy `.env.local.example` to `.env.local` and fill in:
   - Clerk publishable + secret keys (Google-only social login)
   - Supabase project URL + `service_role` key
   - `ALLOWED_EMAILS` — comma-separated list of e-board Google emails

3. Customize the Clerk session token. Clerk dashboard → Sessions → Customize
   session token:
   ```json
   { "email": "{{user.primary_email_address}}" }
   ```

4. Run the SQL below in Supabase SQL Editor (New query → paste → run).

5. Create a private Storage bucket named `luma-csv` in Supabase.

6. `npm run dev` and visit http://localhost:3000.

7. Sign in as an allowlisted e-board member. Go to `/import` and upload the
   latest Luma members CSV.

## Schema

The baseline tables are documented in the SQL block below. When we need to
evolve the schema, migration files live under `supabase/migrations/` and are
applied by pasting into the Supabase SQL Editor.

```sql
create table members (
  user_api_id text primary key,
  name text,
  email text,
  first_seen timestamptz,
  event_approved_count int default 0,
  event_checked_in_count int default 0,
  description text,
  major text,
  grad_year text,
  gender text,
  pronouns text,
  linkedin_url text,
  custom_tags text[],
  hidden boolean default false,
  updated_at timestamptz default now(),
  updated_by text
);

create table blacklist (
  email text primary key,
  name text,
  reason text not null,
  added_by text not null,
  added_at timestamptz default now()
);

create table luma_imports (
  id uuid primary key default gen_random_uuid(),
  uploaded_by text not null,
  uploaded_at timestamptz default now(),
  storage_path text not null,
  row_count int,
  new_count int,
  updated_count int,
  blocked_count int,
  error_count int,
  status text not null
);

create table member_edits (
  id uuid primary key default gen_random_uuid(),
  member_user_api_id text not null references members(user_api_id) on delete cascade,
  editor_email text not null,
  field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz default now()
);

create index members_email_idx on members (lower(email));
create index members_name_idx on members (lower(name));
create index members_checked_in_idx on members (event_checked_in_count desc);
create index blacklist_email_idx on blacklist (lower(email));
create index luma_imports_uploaded_at_idx on luma_imports (uploaded_at desc);
create index member_edits_member_idx on member_edits (member_user_api_id, changed_at desc);
```

### Migrations

After the baseline is in place, apply migrations in order:

- `supabase/migrations/0002_import_hardening.sql` — adds header-mapping
  metadata to `luma_imports`, `import_id`/`source`/`changed_by` to
  `member_edits`, `email_normalized` generated columns to `members` and
  `blacklist`, and a dry-run flag. Idempotent — safe to re-run.

## Seeding

First-time seed goes through the app, not Supabase Table Editor:

1. Run the schema above.
2. Create the `luma-csv` Storage bucket (private).
3. Deploy or run locally. Sign in as an allowlisted VP.
4. Go to `/import` and upload the Luma CSV.

The app upserts only the Luma-sourced columns (`name`, `email`, `first_seen`,
`event_approved_count`, `event_checked_in_count`) — extra columns in the CSV
are ignored. E-board-filled fields (major, tags, etc.) are preserved on
re-import.

## Managing the allowlist

Edit the `ALLOWED_EMAILS` env var (Vercel project settings → Environment
Variables → `ALLOWED_EMAILS`) and redeploy. Entries are comma-separated,
compared lowercase + trimmed. An empty value blocks all users (fail-closed).

## Deploy to Vercel

1. Push this repo to GitHub. Keep it private — the code paths and schema
   surface student PII.
2. Import the repo into Vercel.
3. Add all env vars from `.env.local.example` under Project Settings →
   Environment Variables.
4. Deploy.
5. In Clerk, add your Vercel URL to the allowed redirect origins.

## Security

- **Keep this repo private.** It documents how the PII pipeline works and
  would aid reconnaissance if public.
- **Do not share the deployed URL publicly.** Access is allowlist-gated but
  hostname leaks still invite brute-force sign-in attempts.
- Clerk session tokens carry the email claim. The Supabase service-role key
  is server-only and never sent to the browser.
- CSV uploads land in a private Supabase Storage bucket with service-role
  access only.
- Member edits are audited in `member_edits` (who changed which field, when,
  old vs new value). Blocks and blacklist-driven hides are logged too.

## Tests

```bash
npm test
```

Covers the allowlist, Luma CSV parser, and staleness math. Page-level
verification is manual — spin up `npm run dev` and click through.
