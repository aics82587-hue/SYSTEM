alter table public.threads
  add column if not exists deleted_at timestamptz;

drop policy if exists "Conversation participants can read" on public.threads;
create policy "Conversation participants can read"
  on public.threads for select to authenticated
  using (
    deleted_at is null
    and (
      student_id = (select auth.uid()::uuid)
      or counselor_id = (select auth.uid()::uuid)
      or (
        visibility = 'shared'
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()::uuid)
            and p.role::text = 'counselor'
        )
      )
    )
  );

drop policy if exists "Conversation participants can soft-delete"
  on public.threads;
create policy "Conversation participants can soft-delete"
  on public.threads for update to authenticated
  using (
    deleted_at is null
    and (
      (
        student_id = (select auth.uid()::uuid)
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()::uuid)
            and p.role::text in ('student', 'community_member')
        )
      )
      or (
        visibility = 'shared'
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()::uuid)
            and p.role::text = 'counselor'
        )
      )
    )
  )
  with check (
    deleted_at is not null
    and (
      (
        student_id = (select auth.uid()::uuid)
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()::uuid)
            and p.role::text in ('student', 'community_member')
        )
      )
      or (
        visibility = 'shared'
        and exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()::uuid)
            and p.role::text = 'counselor'
        )
      )
    )
  );

revoke update on public.threads from public, anon, authenticated;
grant update (visibility, shared_at, deleted_at)
  on public.threads to authenticated;
