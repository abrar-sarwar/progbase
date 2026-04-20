"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Member } from "@/lib/types";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { updateMember, blockMember } from "@/app/_actions/members";

const PRESET_GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
];

function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function MemberEditForm({ member }: { member: Member }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [description, setDescription] = useState(member.description ?? "");
  const [major, setMajor] = useState(member.major ?? "");
  const [gradYear, setGradYear] = useState(member.grad_year ?? "");

  const initialGender = member.gender ?? "";
  const genderMatchesOption = PRESET_GENDER_OPTIONS.includes(initialGender);
  const [genderSelect, setGenderSelect] = useState<string>(
    initialGender === ""
      ? ""
      : genderMatchesOption
        ? initialGender
        : "Other (specify)",
  );
  const [genderOther, setGenderOther] = useState(
    genderMatchesOption ? "" : initialGender,
  );

  const [pronouns, setPronouns] = useState(member.pronouns ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(member.linkedin_url ?? "");
  const [tagsRaw, setTagsRaw] = useState(
    (member.custom_tags ?? []).join(", "),
  );
  const [error, setError] = useState<string | null>(null);

  const tags = parseTags(tagsRaw);
  const genderFinal =
    genderSelect === "Other (specify)" ? genderOther.trim() : genderSelect;

  const dirty =
    description !== (member.description ?? "") ||
    major !== (member.major ?? "") ||
    gradYear !== (member.grad_year ?? "") ||
    genderFinal !== (member.gender ?? "") ||
    pronouns !== (member.pronouns ?? "") ||
    linkedinUrl !== (member.linkedin_url ?? "") ||
    JSON.stringify(tags) !== JSON.stringify(member.custom_tags ?? []);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMember(member.user_api_id, {
          description: description || null,
          major: major || null,
          grad_year: gradYear || null,
          gender: genderFinal || null,
          pronouns: pronouns || null,
          linkedin_url: linkedinUrl || null,
          custom_tags: tags.length ? tags : null,
        });
        router.push("/");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function handleBlock() {
    const reason = window.prompt(
      `Block ${member.name ?? member.email ?? member.user_api_id}?\nReason (required):`,
    );
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      try {
        await blockMember(member.user_api_id, reason.trim());
        router.push("/");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Block failed");
      }
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="space-y-5 border-b border-zinc-100 p-5">
        <h2 className="text-sm font-medium text-zinc-900">Profile</h2>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short note about this member…"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Major">
            <Input value={major} onChange={(e) => setMajor(e.target.value)} />
          </Field>
          <Field label="Grad year">
            <Input
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
              placeholder="e.g. 2027"
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Gender">
            <Select
              value={genderSelect}
              onChange={(e) => setGenderSelect(e.target.value)}
            >
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Other (specify)">Other (specify)</option>
            </Select>
            {genderSelect === "Other (specify)" && (
              <Input
                className="mt-2"
                value={genderOther}
                onChange={(e) => setGenderOther(e.target.value)}
                placeholder="Specify…"
              />
            )}
          </Field>
          <Field label="Pronouns">
            <Input
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="e.g. they/them"
            />
          </Field>
        </div>
      </div>
      <div className="space-y-5 border-b border-zinc-100 p-5">
        <h2 className="text-sm font-medium text-zinc-900">Social</h2>
        <Field label="LinkedIn URL">
          <Input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/…"
          />
        </Field>
      </div>
      <div className="space-y-4 p-5">
        <h2 className="text-sm font-medium text-zinc-900">Tags</h2>
        <Field
          label="Custom tags"
          hint="Comma-separated; duplicates removed automatically."
        >
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="e.g. founding, mentor, alum"
          />
        </Field>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t} tone="indigo">
                {t}
              </Chip>
            ))}
          </div>
        )}
      </div>
      {error && (
        <div className="border-t border-red-100 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-b-lg border-t border-zinc-200 bg-white/90 p-3 backdrop-blur">
        <Link href="/">
          <Button variant="ghost" disabled={isPending}>
            Cancel
          </Button>
        </Link>
        <Button variant="danger" onClick={handleBlock} disabled={isPending}>
          Block this member
        </Button>
        <Button onClick={handleSave} disabled={isPending || !dirty}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-700">{label}</span>
      {hint && <span className="block text-[11px] text-zinc-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
