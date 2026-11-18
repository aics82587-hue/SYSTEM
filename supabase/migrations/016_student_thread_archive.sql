begin;

alter table public.threads
  add column if not exists student_archived_at timestamptz;

drop policy if exists "Conversation participants can read" on public.threads;
create policy "Conversation participants can read"
  on public.threads for select to authenticated
  using (
    deleted_at is null
    and (
      (
        student_id = (select auth.uid()::uuid)
        and student_archived_at is null
      )
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

drop policy if exists "Conversation owner can update visibility" on public.threads;
create policy "Conversation owner can update visibility"
  on public.threads for update to authenticated
  using (
    student_id = (select auth.uid()::uuid)
    and deleted_at is null
    and student_archived_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'student'
    )
  )
  with check (
    student_id = (select auth.uid()::uuid)
    and deleted_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'student'
    )
  );

drop policy if exists "Conversation participants can soft-delete" on public.threads;
drop policy if exists "Counselors can soft-delete shared conversations" on public.threads;
create policy "Counselors can soft-delete shared conversations"
  on public.threads for update to authenticated
  using (
    deleted_at is null
    and visibility = 'shared'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'counselor'
    )
  )
  with check (
    deleted_at is not null
    and visibility = 'shared'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'counselor'
    )
  );

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and (
          (
            t.student_id = (select auth.uid()::uuid)
            and t.student_archived_at is null
          )
          or t.counselor_id = (select auth.uid()::uuid)
          or (
            t.visibility = 'shared'
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid()::uuid)
                and p.role::text = 'counselor'
            )
          )
        )
    )
  );

drop policy if exists "Conversation participants can insert messages" on public.messages;
create policy "Conversation participants can insert messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and t.deleted_at is null
        and (
          (
            t.student_id = (select auth.uid()::uuid)
            and t.student_archived_at is null
          )
          or t.counselor_id = (select auth.uid()::uuid)
          or (
            t.visibility = 'shared'
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid()::uuid)
                and p.role::text = 'counselor'
            )
          )
        )
    )
  );

revoke update on public.threads from public, anon, authenticated;
grant update (visibility, shared_at, deleted_at)
  on public.threads to authenticated;

create or replace function public.archive_student_thread(_thread_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _user_id uuid := auth.uid();
  _role text;
begin
  if _user_id is null then
    raise exception 'Authentication required.';
  end if;

  select p.role::text into _role
  from public.profiles p
  where p.id = _user_id;

  if coalesce(_role, '') not in ('student', 'community_member') then
    raise exception 'Only students can archive their own conversations.';
  end if;

  update public.threads
  set student_archived_at = now()
  where id = _thread_id
    and student_id = _user_id
    and deleted_at is null
    and student_archived_at is null;

  return found;
end;
$$;

revoke all on function public.archive_student_thread(uuid)
  from public, anon, authenticated;
grant execute on function public.archive_student_thread(uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
