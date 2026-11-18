-- Mentalks revisions: conversations, profile preferences, message archives,
-- and automatic counselor membership in focus groups.

alter table public.profiles
  add column if not exists position text not null default 'Guidance Counselor',
  add column if not exists privacy_notice_seen_at timestamptz,
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('system', 'light', 'dark'));

update public.profiles
set position = coalesce(nullif(position, ''), 'Guidance Counselor')
where role = 'counselor';

drop policy if exists "Authenticated users can view counselor profiles" on public.profiles;
create policy "Authenticated users can view counselor profiles"
  on public.profiles for select to authenticated
  using (role = 'counselor');

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Account roles cannot be changed from profile settings.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger prevent_profile_role_change
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role text;
  _nickname text;
  _position text;
  _role_type text;
begin
  _role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'student');
  if _role not in ('student', 'counselor') then
    _role := 'student';
  end if;
  _nickname := case when _role = 'counselor'
    then coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'Counselor')
    else coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), 'Student')
  end;
  _position := case when _role = 'counselor'
    then coalesce(nullif(btrim(new.raw_user_meta_data ->> 'position'), ''), 'Guidance Counselor')
    else 'Guidance Counselor'
  end;

  select format('%I.%I', type_namespace.nspname, role_type.typname)
    into _role_type
  from pg_attribute role_column
  join pg_type role_type on role_type.oid = role_column.atttypid
  join pg_namespace type_namespace on type_namespace.oid = role_type.typnamespace
  where role_column.attrelid = 'public.profiles'::regclass
    and role_column.attname = 'role'
    and not role_column.attisdropped;

  execute format(
    'insert into public.profiles (id, student_id, birthdate, nickname, role, position)
     values ($1, $2, $3, $4, $5::%s, $6)
     on conflict (id) do nothing',
    _role_type
  )
  using
    new.id,
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'birthdate', '')::date,
    _nickname,
    _role,
    _position;
  return new;
end;
$$;

alter table public.threads
  alter column student_id drop not null,
  add column if not exists created_by uuid references public.profiles(id) on delete cascade,
  add column if not exists counselor_id uuid references public.profiles(id) on delete cascade;

update public.threads set created_by = student_id where created_by is null;

alter table public.private_messages
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;

drop policy if exists "Students see own threads" on public.threads;
drop policy if exists "Students insert own threads" on public.threads;
drop policy if exists "Students update own threads" on public.threads;
drop policy if exists "student owns threads" on public.threads;
drop policy if exists "Counselors see shared threads" on public.threads;
drop policy if exists "Conversation participants can read" on public.threads;
drop policy if exists "Conversation owner can update visibility" on public.threads;

create policy "Conversation participants can read"
  on public.threads for select to authenticated
  using (
    student_id = (select auth.uid())
    or counselor_id = (select auth.uid())
    or (
      visibility = 'shared'
      and exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'counselor'
      )
    )
  );

create policy "Conversation owner can update visibility"
  on public.threads for update to authenticated
  using (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
  )
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    )
  );

revoke update on public.threads from public, anon, authenticated;
grant update (visibility, shared_at) on public.threads to authenticated;

drop policy if exists "Thread participants can read messages" on public.messages;
drop policy if exists "Thread participants can insert messages" on public.messages;
drop policy if exists "Conversation participants can read messages" on public.messages;
drop policy if exists "Conversation participants can insert messages" on public.messages;

create policy "Conversation participants can read messages"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (
          t.student_id = (select auth.uid())
          or t.counselor_id = (select auth.uid())
          or (
            t.visibility = 'shared'
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid()) and p.role = 'counselor'
            )
          )
        )
    )
  );

create policy "Conversation participants can insert messages"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (
          t.student_id = (select auth.uid())
          or t.counselor_id = (select auth.uid())
          or (
            t.visibility = 'shared'
            and exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid()) and p.role = 'counselor'
            )
          )
        )
    )
  );

create or replace function public.create_conversation(
  _title text,
  _body text,
  _student_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _role text;
  _thread_id uuid;
begin
  if _uid is null then
    raise exception 'Please sign in to create a conversation.';
  end if;
  if nullif(btrim(_title), '') is null or length(btrim(_title)) > 120 then
    raise exception 'Enter a conversation title of 1 to 120 characters.';
  end if;
  if nullif(btrim(_body), '') is null or length(btrim(_body)) > 10000 then
    raise exception 'Enter a first message of 1 to 10000 characters.';
  end if;

  select role into _role from public.profiles where id = _uid;
  if _role = 'student' then
    insert into public.threads (student_id, created_by, title, visibility)
    values (_uid, _uid, btrim(_title), 'private')
    returning id into _thread_id;
  elsif _role = 'counselor' then
    if _student_id is null or not exists (
      select 1 from public.profiles where id = _student_id and role = 'student'
    ) then
      raise exception 'Choose a valid student for this conversation.';
    end if;
    insert into public.threads (student_id, counselor_id, created_by, title, visibility, shared_at)
    values (_student_id, _uid, _uid, btrim(_title), 'shared', now())
    returning id into _thread_id;
  else
    raise exception 'Only students and counselors can create conversations.';
  end if;

  insert into public.messages (thread_id, sender_id, body)
  values (_thread_id, _uid, btrim(_body));
  return _thread_id;
end;
$$;

revoke all on function public.create_conversation(text, text, uuid) from public, anon;
grant execute on function public.create_conversation(text, text, uuid) to authenticated;

-- Prevent counselors from archiving/deleting student messages after a reply.
create or replace function public.validate_private_message_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role text;
begin
  if (new.archived_at is distinct from old.archived_at and new.archived_at is not null)
     or new.deleted_at is distinct from old.deleted_at then
    select role into _role from public.profiles where id = auth.uid();
    if _role = 'student' then
      if old.student_id <> auth.uid() or old.sender_id <> auth.uid() then
        raise exception 'You can only archive or delete your own messages.';
      end if;
    elsif _role = 'counselor' and new.archived_at is distinct from old.archived_at
      and new.archived_at is null and old.archived_at is not null then
      if old.sender_id <> old.student_id then
        raise exception 'Counselors can only restore student messages.';
      end if;
    elsif _role = 'counselor' then
      if old.sender_id <> old.student_id or exists (
        select 1 from public.private_messages reply
        where reply.student_id = old.student_id
          and reply.sender_id <> old.student_id
          and reply.created_at > old.created_at
      ) then
        raise exception 'Counselors can only archive unanswered student messages.';
      end if;
    else
      raise exception 'You are not allowed to archive or delete messages.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_private_message_archive on public.private_messages;
create trigger validate_private_message_archive
  before update on public.private_messages
  for each row execute function public.validate_private_message_archive();

drop policy if exists "Students see own private messages" on public.private_messages;
create policy "Students see own private messages"
  on public.private_messages for select to authenticated
  using (student_id = (select auth.uid()));

drop policy if exists "Students update own private messages" on public.private_messages;
create policy "Students update own private messages"
  on public.private_messages for update to authenticated
  using (student_id = (select auth.uid()) and sender_id = (select auth.uid()))
  with check (student_id = (select auth.uid()) and sender_id = (select auth.uid()));

drop policy if exists "Counselors update messages (flag/ignore/read)" on public.private_messages;
create policy "Counselors update messages (flag/ignore/read)"
  on public.private_messages for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'counselor'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'counselor'
    )
  );

-- Enroll all counselors in existing and newly-created focus groups.
create or replace function public.enroll_counselors_in_focus_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.focus_group_members (group_id, user_id)
  select new.id, p.id from public.profiles p where p.role = 'counselor'
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists enroll_counselors_in_focus_group on public.focus_groups;
create trigger enroll_counselors_in_focus_group
  after insert on public.focus_groups
  for each row execute function public.enroll_counselors_in_focus_group();

create or replace function public.enroll_new_counselor_in_focus_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'counselor' then
    insert into public.focus_group_members (group_id, user_id)
    select g.id, new.id from public.focus_groups g
    on conflict (group_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists enroll_new_counselor_in_focus_groups on public.profiles;
create trigger enroll_new_counselor_in_focus_groups
  after insert or update of role on public.profiles
  for each row execute function public.enroll_new_counselor_in_focus_groups();

insert into public.focus_group_members (group_id, user_id)
select g.id, p.id
from public.focus_groups g
cross join public.profiles p
where p.role = 'counselor'
on conflict (group_id, user_id) do nothing;

-- Enable realtime for conversation messages (safe to rerun).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then
  null;
end;
$$;
