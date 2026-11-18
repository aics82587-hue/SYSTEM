create table if not exists public.counselor_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'counselor' check (role = 'counselor'),
  version text not null check (length(btrim(version)) between 1 and 80),
  statements jsonb not null check (
    jsonb_typeof(statements) = 'object'
    and statements @> '{
      "safe_space": true,
      "confidentiality": true,
      "voluntary_participation": true,
      "referral_transparency": true,
      "story_publication": true,
      "timely_response": true
    }'::jsonb
  ),
  acknowledged_at timestamptz not null default now(),
  unique (user_id, version)
);

alter table public.counselor_acknowledgments enable row level security;

drop policy if exists "Counselors read own acknowledgments"
  on public.counselor_acknowledgments;
create policy "Counselors read own acknowledgments"
  on public.counselor_acknowledgments for select to authenticated
  using (
    user_id = (select auth.uid()::uuid)
    and role = 'counselor'
    and exists (
      select 1 from public.profiles p
      where p.id = counselor_acknowledgments.user_id
        and p.role::text = 'counselor'
    )
  );

drop policy if exists "Counselors insert own acknowledgments"
  on public.counselor_acknowledgments;
create policy "Counselors insert own acknowledgments"
  on public.counselor_acknowledgments for insert to authenticated
  with check (
    user_id = (select auth.uid()::uuid)
    and role = 'counselor'
    and exists (
      select 1 from public.profiles p
      where p.id = counselor_acknowledgments.user_id
        and p.role::text = 'counselor'
    )
  );

revoke all on public.counselor_acknowledgments from anon, authenticated;
grant select, insert on public.counselor_acknowledgments to authenticated;

notify pgrst, 'reload schema';
