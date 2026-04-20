export type Member = {
  user_api_id: string;
  name: string | null;
  email: string | null;
  first_seen: string | null;
  event_approved_count: number;
  event_checked_in_count: number;
  description: string | null;
  major: string | null;
  grad_year: string | null;
  gender: string | null;
  pronouns: string | null;
  linkedin_url: string | null;
  custom_tags: string[] | null;
  hidden: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type BlacklistEntry = {
  email: string;
  name: string | null;
  reason: string;
  added_by: string;
  added_at: string;
};

export type LumaImport = {
  id: string;
  uploaded_by: string;
  uploaded_at: string;
  storage_path: string;
  row_count: number | null;
  new_count: number | null;
  updated_count: number | null;
  blocked_count: number | null;
  error_count: number | null;
  status: "success" | "partial" | "failed";
};
