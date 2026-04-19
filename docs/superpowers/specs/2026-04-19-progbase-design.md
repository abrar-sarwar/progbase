# progbase — Design Spec

**Date:** 2026-04-19
**Owner:** progsu e-board (Georgia State University)
**Status:** Approved for planning

## 1. Purpose

Internal member dashboard for progsu, a college club at Georgia State. VPs use it
to view member lists imported from Luma, fill in demographic/contact fields that
Luma doesn't carry, run analytics on attendance, and maintain a blacklist. Not
member-facing.

## 2. Stack (fixed)

- Next.js 14, App Router, TypeScript
- Tailwind CSS
- Clerk (Google sign-in only)
- Supabase (Postgres + Storage), service-role key server-only
- papaparse (CSV parsing)
- recharts (analytics charts)

No other runtime dependencies.

## 3. Trust model

All non-public routes pass through `middleware.ts`:

1. Clerk session check. No session → redirect to `/sign-in`.
2. Allowlist check: `session.user.emailAddresses[0].emailAddress`, lowercased and
   trimmed, must be present in `ALLOWED_EMAILS` env var (comma-separated,
   lowercased+trimmed on compare). Miss → redirect to `/unauthorized`.
3. Fail-closed: if `ALLOWED_EMAILS` is empty or unset, every authenticated user
   gets bounced to `/unauthorized`.

Public routes: `/sign-in`, `/unauthorized`, Clerk's internal routes.

All Supabase reads/writes use the service-role key and happen in server
components or server actions. `lib/supabase-server.ts` starts with
`import "server-only"` so any accidental client import throws at build.

## 4. File layout

```
app/
  layout.tsx                 ClerkProvider + <Header /> (conditional on auth)
  page.tsx                   Members list (server fetch → client table)
  sign-in/page.tsx           Clerk <SignIn />
  unauthorized/page.tsx
  members/[id]/page.tsx      Edit form
  members/[id]/actions.ts    Server actions: updateMember, blockMember
  import/page.tsx            Upload UI + last-import badge
  import/actions.ts          Server action: importCsv
  analytics/page.tsx         Server aggregates → client <Charts />
  blacklist/page.tsx         Table + add form
  blacklist/actions.ts       addBlacklist, removeBlacklist, rehideOrUnhide
components/
  header.tsx
  members-table.tsx
  charts/*.tsx
  ui/* (button, input, chip, dropzone)
lib/
  supabase-server.ts         service-role client, server-only
  allowlist.ts               isAllowed(email)
  csv.ts                     parseLumaCsv(buffer)
  freshness.ts               getLastImport(), isStale()
middleware.ts
```

## 5. Database schema

User runs SQL manually in Supabase. Spec includes CREATE TABLE statements in the
README for copy-paste. The full schema is:

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
  status text not null         -- 'success' | 'partial' | 'failed'
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

Supabase Storage: one private bucket named `luma-csv`, service-role access only.

## 6. CSV freshness flow

Initial-seed path is the same as steady-state — there is no separate
"Supabase Table Editor import" step. The first VP to sign in uploads the CSV.

1. VP navigates to `/import`, uploads the CSV.
2. Server action `importCsv`:
   - Reads file, strips leading `\uFEFF` BOM.
   - Uploads raw bytes to `luma-csv/YYYY-MM-DD-HHMMSS-<uuid>.csv` (history
     retained; Storage is cheap).
   - Parses with papaparse (`header: true`, `skipEmptyLines: true`).
   - For each row: check `blacklist` for `lower(trim(email))`. Hit → skip,
     increment `blockedCount`.
   - Remaining rows: upsert into `members` on `user_api_id` conflict. Columns
     written from CSV: `name`, `email`, `first_seen`, `event_approved_count`,
     `event_checked_in_count`. All other CSV columns ignored.
   - On conflict, update only the Luma-sourced fields above. Do NOT overwrite
     `description`, `major`, `grad_year`, `gender`, `pronouns`, `linkedin_url`,
     `custom_tags`, `hidden`.
   - Coerce event counts to int (default 0). Parse `first_seen` as timestamptz;
     unparseable → null (not fatal).
   - Insert one `luma_imports` row with counts and status.
3. `lib/freshness.ts` exposes `getLastImport()` — reads the most recent
   `luma_imports` row.
4. On any server-rendered page: if `uploaded_at > 7 days ago`, `<Header />`
   renders an amber "CSV is N days stale — re-upload" chip linking to
   `/import`. N is `Math.floor((now - uploaded_at) / 86_400_000)`. Dismissable
   via a session cookie (HttpOnly, SameSite=Lax, 24h TTL). Re-appears next
   session.
5. `/import` page always shows "Last import: MM/DD/YYYY by [email] — X new, Y
   updated" — even when fresh.

**Zero-imports state:** `/` and `/analytics` render a neutral empty state ("No
members imported yet — Upload CSV") instead of the amber stale banner.

## 7. Pages

### `/` Members list
- Server component fetches `members where hidden = false`, ordered by
  `event_checked_in_count DESC, event_approved_count DESC, first_seen ASC`.
- Client table: Name, Email, Major, Grad Year, Gender, First Seen (MM/DD/YYYY),
  Events Approved, Events Checked In, Actions.
- Sortable columns (click toggles asc/desc, default = Events Checked In desc).
- Live search (case-insensitive, filters name + email).
- Empty fields render `—` in `text-zinc-300`.
- Row count display "X members" updates on filter.
- Actions: `Edit` link → `/members/[id]`; `Block` ghost button → prompts for
  reason, calls server action.
- Sticky header, no zebra rows, `hover:bg-zinc-50/60`. Horizontal scroll on
  mobile via `overflow-x-auto`.

### `/members/[id]` Edit
- Two-column layout on `md+`. Left: form sections "Profile" (description,
  major, grad_year, gender dropdown + "Other (specify)" free-text, pronouns),
  "Social" (linkedin_url), "Tags" (comma-separated input with chip preview).
- Right: read-only "Luma data" panel — `first_seen`, `event_approved_count`,
  `event_checked_in_count`.
- Sticky bottom action bar: Cancel (ghost) ← Block this member (red ghost) ←
  Save changes (indigo primary, disabled until dirty).
- Gender dropdown options: Male, Female, Non-binary, Prefer not to say,
  Other (specify). Empty default. No auto-inference ever.
- `custom_tags` input: split on commas, trim each, drop empties, dedupe
  case-insensitively, store as `text[]`.
- Block action uses native `window.prompt("Reason for blocking?")`. Empty =
  cancel. Server action adds to blacklist + sets `hidden = true`.
- Save writes a `member_edits` row per changed field: who, field, old, new.
  CSV upserts do NOT write to `member_edits` — that table captures only
  user-driven edits from the edit page and the block action.
- Last-write-wins for concurrent edits (no optimistic locking).

### `/import`
- Single centered column, `max-w-xl`.
- Top card: "Last import" status — date, uploader, counts. Amber icon if
  > 7 days.
- Dashed dropzone for file input, `.csv` only. Reject files > 10MB before
  parse.
- Missing required column (`user_api_id`, `name`, `email`) → reject whole
  file, display which column is missing. No partial imports.
- Row with blank `user_api_id` → skip, increment `error_count`.
- Unparseable `first_seen` → store null, not fatal.
- Duplicate `user_api_id` within same CSV → last one wins.
- After import: summary "X new · Y updated · Z blocked · W errors." If errors,
  expandable list of row numbers + messages.

### `/analytics`
- Server aggregates, passed to client `<Charts />` components.
- Excludes `hidden = true` members from all counts.
- Charts:
  - Member growth: line chart, cumulative members by `first_seen` month.
    Members with null `first_seen` excluded from this chart but counted in
    totals.
  - Attendance distribution: bar chart, buckets `0, 1, 2-3, 4-5, 6-10, 10+` of
    `event_approved_count`.
  - Active vs dormant: pie chart (active = `event_checked_in_count ≥ 1`).
  - Email domain breakdown: bar chart, top 10 domains.
  - Demographics: bar charts for `major`, `grad_year`, `gender`. Each shows a
    coverage note above: "X% of members have this field filled." Only charts
    non-null rows. No inference. Denominator = non-hidden members; numerator
    = non-hidden members with that specific field non-null and non-empty.
- Empty demographic (e.g., 0% coverage): placeholder "No data yet — fill in
  members to see this." Coverage note reads "0%."
- Single-domain edge: renders one bar.
- Indigo-500 primary, `zinc-300` axes, `zinc-600` labels. No gradient fills.

### `/blacklist`
- Columns: Email, Name, Reason (truncated + hover tooltip), Added By, Added
  At, Remove.
- Sortable + searchable.
- "Add to blacklist" inline collapsible form: email (required), name
  (optional), reason (required).
- Remove → `confirm()` → delete row → prompt "Also un-hide this member in
  members?" → if yes, set `hidden = false` on matching `members` row.

### `/unauthorized`
- Full-page centered. "You're not authorized for progbase." + "Contact the
  progsu VP." + Clerk sign-out button.

### `/sign-in`
- Full-page centered. `progbase` wordmark + Clerk `<SignIn />` with
  `appearance` prop customized (zinc borders, indigo primary).

## 8. Visual system (Linear-density)

**Header:** 48px tall, `bg-white`, `border-b border-zinc-200`. Left:
`progbase` wordmark (`font-semibold text-zinc-900 tracking-tight`) with small
indigo glyph. Center: tab-style nav (Members, Analytics, Import, Blacklist).
Active tab = `text-zinc-900` + 2px indigo underline; inactive =
`text-zinc-500 hover:text-zinc-900`. No pill backgrounds. Right: stale-CSV
chip (amber-50 bg, amber-800 text, `rounded-sm text-xs`) if applicable, then
`<UserButton />`.

**Tables:** sticky header in `bg-zinc-50`, `text-[11px] uppercase tracking-wider
text-zinc-500`, `h-9`. Rows `h-10 text-sm border-b border-zinc-100`. No zebra.
Hover `bg-zinc-50/60`. Numeric columns right-aligned, `font-mono tabular-nums`.
Zero values `text-zinc-400`.

**Inputs:** `h-8`, `rounded-md`, thin border `border-zinc-300`,
`focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500`. Placeholder
`text-zinc-400`.

**Buttons:**
- Primary: `bg-indigo-600 hover:bg-indigo-700 text-white`, `h-8 px-3 rounded-md
  text-sm font-medium`.
- Ghost: `text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100`.
- Destructive ghost: `text-zinc-500 hover:text-red-600`.

**Chips:** `inline-flex h-5 px-1.5 rounded-sm text-[11px] font-medium`.
Variants: zinc (neutral), amber (warning), green (success), red (danger).

**Chart sections:** 1px `border-zinc-200`, `rounded-lg`, `p-5`, no shadow.
Title `text-sm font-medium`, subtitle `text-xs text-zinc-500`.

**Palette:** zinc for text/borders; indigo-500/600 for accent, selection, and
primary actions; amber for warnings; red for destructive confirmations. No
dark mode yet.

## 9. Error handling & edge cases

### CSV import
- File > 10MB → reject before parse.
- Missing required column → reject whole file, show which column is missing.
- Blank `user_api_id` → skip row, increment `error_count`.
- Unparseable `first_seen` → store null, not fatal.
- Row email in blacklist → skipped, `blocked_count` increment, not an error.
- Duplicate `user_api_id` in same file → last one wins.
- Storage upload succeeds but upsert fails midway → wrapped in try/catch. No
  `luma_imports` row written. VP sees "Import failed" with the error. Next
  attempt is a fresh upload.
- Leading BOM (`\uFEFF`) stripped before parse.

### Member edit
- Concurrent edits: last-write-wins.
- Empty gender dropdown + non-empty "Other" text → stores the free-text.
- Member blocked while being edited: next save refuses with "This member is
  now hidden."

### Freshness banner
- Zero imports ever → empty state on `/` and `/analytics`, no amber banner.
- Dismissed via session cookie, 24h TTL, re-shows next session.

### Auth
- Signed-in non-allowlisted user → `/unauthorized`.
- Allowlist changed mid-session → next request blocked.
- `ALLOWED_EMAILS` missing/empty → fail-closed, all users bounced.

### Analytics
- Null `first_seen` → excluded from growth chart only.
- Empty demographic field → "No data yet" placeholder, "0%" coverage note.
- Single email domain → one bar, no error.

## 10. Non-goals

- Dark mode.
- "History" tab on edit page viewing `member_edits`. Table exists and
  populates, but no UI to view it yet.
- Bulk actions (multi-select delete/block).
- CSV export from the app (Supabase Table Editor can do it).
- Member-facing pages, email, notifications, cron, Luma API, scraping.
- Role hierarchy beyond allowlist. Every allowlisted user has full power.
- Dependency additions beyond the six listed in Section 2.

## 11. Env vars

`.env.local.example`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ALLOWED_EMAILS=email1@gsu.edu,email2@gsu.edu
```

## 12. README requirements

- One-line description.
- Setup: install, env vars, run dev.
- Deploy-to-Vercel instructions.
- How to manage the allowlist (edit `ALLOWED_EMAILS`, redeploy).
- Full SQL block for copy-paste into Supabase SQL editor (Section 5 above).
- Instructions for creating the `luma-csv` Storage bucket (private).
- Seed flow: first VP signs in → goes to `/import` → uploads the Luma CSV.
  There is no Supabase Table Editor seed step.
- Warning: contains student PII — keep repo private, don't share deployed URL
  publicly.

## 13. Files to gitignore

`.env.local`, `*.csv`, `node_modules`, `.next`, `.vercel`.

The existing Luma CSV in the repo root (`progsu @ GeorgiaState - Members -
2026-04-19-22-56-44.csv`) must be gitignored immediately — it contains PII and
must not land in history.
