-- MenTalks identity privacy, consent, schedule, and counselor referrals.
-- Run after 009_community_member_role.sql.

alter table public.profiles
  add column if not exists pen_name text,
  add column if not exists public_name text,
  add column if not exists avatar_id text not null default 'lavender-cat',
  add column if not exists pen_name_changed_at timestamptz,
  add column if not exists position text not null default 'BSC Community Member';

create table if not exists public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  student_id text,
  birthdate date,
  created_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_private' and column_name = 'real_name'
  ) then
    execute 'alter table public.profile_private alter column real_name drop not null';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_private' and column_name = 'nickname'
  ) then
    execute 'alter table public.profile_private alter column nickname drop not null';
  end if;
end;
$$;

insert into public.profile_private (user_id, student_id, birthdate)
select p.id, p.student_id, p.birthdate
from public.profiles p
on conflict (user_id) do update
set student_id = excluded.student_id,
    birthdate = excluded.birthdate;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname'
  ) then
    execute $migration$
      update public.profiles
      set pen_name = coalesce(pen_name, 'BSC Member ' || upper(substr(replace(id::text, '-', ''), 1, 8))),
          public_name = case when role::text = 'student'
            then coalesce(pen_name, 'BSC Member ' || upper(substr(replace(id::text, '-', ''), 1, 8)))
            else coalesce(nullif(public_name, ''), nullif(nickname, ''), 'BSC Community Member')
          end,
          position = case when role::text = 'counselor'
            then coalesce(nullif(position, ''), 'Guidance Counselor')
            when role::text = 'community_member'
            then coalesce(nullif(position, ''), 'BSC Community Member')
            else position
          end
      where role::text = 'student' or public_name is null
    $migration$;
  else
    update public.profiles
    set pen_name = coalesce(pen_name, 'BSC Member ' || upper(substr(replace(id::text, '-', ''), 1, 8))),
        public_name = case when role::text = 'student'
          then coalesce(pen_name, 'BSC Member ' || upper(substr(replace(id::text, '-', ''), 1, 8)))
          else coalesce(nullif(public_name, ''), 'BSC Community Member')
        end,
        position = case when role::text = 'counselor'
          then coalesce(nullif(position, ''), 'Guidance Counselor')
          when role::text = 'community_member'
          then coalesce(nullif(position, ''), 'BSC Community Member')
          else position
        end
    where role::text = 'student' or public_name is null;
  end if;
end;
$$;

update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) - 'full_name' - 'nickname'
where exists (
  select 1 from public.profiles p
  where p.id = u.id and p.role::text = 'student'
);

create unique index if not exists profiles_pen_name_lower_unique
  on public.profiles (lower(btrim(pen_name)))
  where pen_name is not null;

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  version text not null,
  event_type text not null check (event_type in ('accepted', 'withdrawn')),
  choices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists consent_records_user_created_idx
  on public.consent_records (user_id, created_at desc);
alter table public.consent_records enable row level security;

create table if not exists public.mentalks_schedule (
  id integer primary key check (id = 1),
  schedule_text text not null default 'Every first Friday of the month',
  location text not null default 'Guidance Counselor''s Office',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.mentalks_schedule (id) values (1) on conflict (id) do nothing;
alter table public.mentalks_schedule enable row level security;

create table if not exists public.referral_services (
  id uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default '',
  contact_details text not null default '',
  location text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referral_services_counselor_active_idx
  on public.referral_services (counselor_id, archived_at);
alter table public.referral_services enable row level security;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  counselor_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid references public.referral_services(id) on delete set null,
  service_name text not null,
  service_type text not null default '',
  contact_details text not null default '',
  location text not null default '',
  reason text not null,
  urgency text not null default 'routine' check (urgency in ('routine', 'soon', 'urgent')),
  status text not null default 'sent' check (status in ('sent', 'seen', 'scheduled', 'completed', 'closed')),
  message text not null default '',
  follow_up_date date,
  counselor_followup_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists referrals_student_created_idx on public.referrals (student_id, created_at desc);
create index if not exists referrals_counselor_status_idx on public.referrals (counselor_id, status, created_at desc);
alter table public.referrals enable row level security;

create table if not exists public.referral_messages (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists referral_messages_referral_created_idx
  on public.referral_messages (referral_id, created_at);
alter table public.referral_messages enable row level security;

-- Earlier referral drafts used text for IDs. Normalize those columns before
-- creating policies that compare them with auth.uid() or UUID foreign keys.
do $$
declare
  _column record;
  _data_type text;
begin
  for _column in
    select * from (values
      ('referral_services', 'counselor_id'),
      ('referrals', 'student_id'),
      ('referrals', 'counselor_id'),
      ('referrals', 'service_id'),
      ('referral_messages', 'referral_id'),
      ('referral_messages', 'sender_id')
    ) as id_columns(table_name, column_name)
  loop
    select c.data_type into _data_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = _column.table_name
      and c.column_name = _column.column_name;

    if _data_type is not null and _data_type <> 'uuid' then
      execute format(
        'alter table public.%I alter column %I type uuid using %I::uuid',
        _column.table_name,
        _column.column_name,
        _column.column_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.is_counselor_or_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid)
      and p.role::text in ('counselor', 'moderator')
  );
$$;

create or replace function public.is_counselor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid) and p.role::text = 'counselor'
  );
$$;

revoke all on function public.is_counselor_or_moderator() from public, anon;
revoke all on function public.is_counselor() from public, anon;
grant execute on function public.is_counselor_or_moderator() to authenticated;
grant execute on function public.is_counselor() to authenticated;

create or replace function public.set_member_restriction(_user_id uuid, _restricted boolean, _until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid) and p.role::text = 'moderator'
  ) then
    raise exception 'Only a moderator can restrict a member.';
  end if;
  update public.profiles
  set is_restricted = _restricted,
      restricted_until = case when _restricted then _until else null end
  where id = _user_id;
  if not found then raise exception 'Member profile not found.'; end if;
end;
$$;
revoke all on function public.set_member_restriction(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.set_member_restriction(uuid, boolean, timestamptz) to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Counselors/Moderators can read all profiles" on public.profiles;
drop policy if exists "Authenticated users can view counselor profiles" on public.profiles;
drop policy if exists "Public identity profiles visible to members" on public.profiles;
create policy "Public identity profiles visible to members"
  on public.profiles for select to authenticated
  using ((select auth.uid()::uuid) is not null);

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Members update allowed profile fields" on public.profiles;
create policy "Members update allowed profile fields"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()::uuid))
  with check (id = (select auth.uid()::uuid));

drop policy if exists "Private profile owner or counselor reads" on public.profile_private;
create policy "Private profile owner or counselor reads"
  on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()::uuid) or public.is_counselor_or_moderator());

drop policy if exists "Public can read MenTalks schedule" on public.mentalks_schedule;
drop policy if exists "Counselor manages MenTalks schedule" on public.mentalks_schedule;
create policy "Public can read MenTalks schedule"
  on public.mentalks_schedule for select to anon, authenticated using (true);
create policy "Counselor manages MenTalks schedule"
  on public.mentalks_schedule for all to authenticated
  using (public.is_counselor())
  with check (public.is_counselor());

drop policy if exists "Owner and counselor read consent records" on public.consent_records;
create policy "Owner and counselor read consent records"
  on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()::uuid) or public.is_counselor());

drop policy if exists "Counselor manages own referral directory" on public.referral_services;
create policy "Counselor manages own referral directory"
  on public.referral_services for all to authenticated
  using (counselor_id = (select auth.uid()::uuid) and public.is_counselor())
  with check (counselor_id = (select auth.uid()::uuid) and public.is_counselor());

drop policy if exists "Referral visible to owner and assigned counselor" on public.referrals;
drop policy if exists "Counselor creates referral for a student" on public.referrals;
drop policy if exists "Participants update referral status" on public.referrals;
create policy "Referral visible to owner and assigned counselor"
  on public.referrals for select to authenticated
  using (
    student_id = (select auth.uid()::uuid)
    or (counselor_id = (select auth.uid()::uuid) and public.is_counselor())
  );
create policy "Counselor creates referral for a student"
  on public.referrals for insert to authenticated
  with check (
    counselor_id = (select auth.uid()::uuid)
    and public.is_counselor()
    and exists (
      select 1 from public.profiles s
      where s.id = referrals.student_id and s.role::text = 'student'
    )
    and (
      service_id is null
      or exists (
        select 1 from public.referral_services rs
        where rs.id = referrals.service_id
          and rs.counselor_id = (select auth.uid()::uuid)
          and rs.archived_at is null
      )
    )
  );
create policy "Participants update referral status"
  on public.referrals for update to authenticated
  using (
    student_id = (select auth.uid()::uuid)
    or (counselor_id = (select auth.uid()::uuid) and public.is_counselor())
  )
  with check (
    student_id = (select auth.uid()::uuid)
    or (counselor_id = (select auth.uid()::uuid) and public.is_counselor())
  );

drop policy if exists "Referral participants read messages" on public.referral_messages;
drop policy if exists "Referral participants send messages" on public.referral_messages;
create policy "Referral participants read messages"
  on public.referral_messages for select to authenticated
  using (exists (
    select 1 from public.referrals r
    where r.id = referral_messages.referral_id
      and (r.student_id = (select auth.uid()::uuid) or r.counselor_id = (select auth.uid()::uuid))
  ));
create policy "Referral participants send messages"
  on public.referral_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.referrals r
      where r.id = referral_messages.referral_id
        and (r.student_id = (select auth.uid()::uuid) or r.counselor_id = (select auth.uid()::uuid))
    )
  );

revoke all on public.profiles from anon, authenticated;
grant select (id, role, position, pen_name, public_name, avatar_id, theme_preference, created_at)
  on public.profiles to authenticated;
grant update (pen_name, avatar_id, theme_preference)
  on public.profiles to authenticated;
revoke all on public.profile_private from anon, authenticated;
grant select on public.profile_private to authenticated;
revoke all on public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;
revoke all on public.mentalks_schedule from anon, authenticated;
grant select on public.mentalks_schedule to anon, authenticated;
grant update (schedule_text, location, note, updated_by, updated_at)
  on public.mentalks_schedule to authenticated;
revoke all on public.referral_services from anon, authenticated;
grant select, insert, update on public.referral_services to authenticated;
revoke all on public.referrals from anon, authenticated;
grant select, insert, update on public.referrals to authenticated;
revoke all on public.referral_messages from anon, authenticated;
grant select, insert on public.referral_messages to authenticated;

create or replace function public.is_valid_pen_name(_candidate text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  _normalized text := lower(regexp_replace(coalesce(btrim(_candidate), ''), '[^a-z0-9]', '', 'g'));
begin
  if length(btrim(coalesce(_candidate, ''))) < 3 or length(btrim(_candidate)) > 32 then
    return false;
  end if;
  if btrim(_candidate) !~ '^[[:alnum:]][[:alnum:] _.-]*$' then
    return false;
  end if;
  if _normalized ~ '(fuck|shit|bitch|asshole|bastard|slut|whore|cunt|dick|pussy|nigger|faggot)' then
    return false;
  end if;
  if _normalized ~ '(admin|moderator|counselor|guidance|official|anonymous|support)' then
    return false;
  end if;
  return true;
end;
$$;
drop function if exists public.is_valid_pen_name(text, text, text);

create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
      and coalesce(auth.role(), '') <> 'service_role'
      and session_user not in ('postgres', 'supabase_admin') then
      raise exception 'Account roles are assigned by an administrator.';
    end if;
    if new.position is distinct from old.position
      and coalesce(auth.role(), '') <> 'service_role'
      and session_user not in ('postgres', 'supabase_admin') then
      raise exception 'Position is managed by an administrator.';
    end if;
    if new.pen_name is distinct from old.pen_name then
      if old.pen_name_changed_at is not null
        and now() < old.pen_name_changed_at + interval '30 days' then
        raise exception 'Pen names can be changed once every 30 days.';
      end if;
      if new.role::text <> 'student'
        or not public.is_valid_pen_name(new.pen_name) then
        raise exception 'Choose a unique, appropriate pen name that is 3–32 characters.';
      end if;
      new.pen_name_changed_at := now();
      new.public_name := new.pen_name;
    end if;
    if new.avatar_id is distinct from old.avatar_id
      and new.avatar_id not in ('lavender-cat', 'sleepy-bear', 'soft-fox', 'cloud-bunny',
        'little-owl', 'sunny-flower', 'tiny-cactus', 'moon-panda') then
      raise exception 'Choose an avatar from the available collection.';
    end if;
    if (
      new.public_name is distinct from old.public_name
      or new.student_id is distinct from old.student_id
      or new.birthdate is distinct from old.birthdate
    ) and coalesce(auth.role(), '') <> 'service_role'
      and session_user not in ('postgres', 'supabase_admin')
      and not (
        new.role::text = 'student'
        and new.pen_name is distinct from old.pen_name
        and new.public_name is not distinct from new.pen_name
        and new.student_id is not distinct from old.student_id
        and new.birthdate is not distinct from old.birthdate
      ) then
      raise exception 'Student registration details can only be changed by an administrator.';
    end if;
  elsif tg_op = 'INSERT' then
    if new.avatar_id not in ('lavender-cat', 'sleepy-bear', 'soft-fox', 'cloud-bunny',
      'little-owl', 'sunny-flower', 'tiny-cactus', 'moon-panda') then
      raise exception 'Choose an avatar from the available collection.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_identity on public.profiles;
drop trigger if exists prevent_profile_role_change on public.profiles;
create trigger protect_profile_identity
  before insert or update on public.profiles
  for each row execute function public.protect_profile_identity();

create or replace function public.record_consent(_version text, _choices jsonb, _event_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid()::uuid;
  _id uuid;
begin
  if _uid is null then raise exception 'Sign in to save your consent choice.'; end if;
  if _version is null or length(btrim(_version)) not between 1 and 80 then
    raise exception 'Invalid consent version.';
  end if;
  if _event_type not in ('accepted', 'withdrawn') then
    raise exception 'Invalid consent action.';
  end if;
  if _event_type = 'accepted' and not (
    _choices -> 'purpose' = 'true'::jsonb
    and _choices -> 'voluntary' = 'true'::jsonb
    and _choices -> 'identity_protection' = 'true'::jsonb
    and _choices -> 'publication_review' = 'true'::jsonb
    and _choices -> 'referral_sharing' = 'true'::jsonb
    and coalesce(_choices -> 'public_release', 'false'::jsonb) in ('true'::jsonb, 'false'::jsonb)
  ) then
    raise exception 'Please review and accept each required consent statement.';
  end if;
  insert into public.consent_records (user_id, version, event_type, choices)
  values (_uid, btrim(_version), _event_type, coalesce(_choices, '{}'::jsonb))
  returning id into _id;
  return _id;
end;
$$;
revoke all on function public.record_consent(text, jsonb, text) from public, anon;
grant execute on function public.record_consent(text, jsonb, text) to authenticated;

drop policy if exists "Conversation owner can update visibility" on public.threads;
create policy "Conversation owner can update visibility"
  on public.threads for update to authenticated
  using (
    student_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid) and p.role::text in ('student', 'community_member')
    )
  )
  with check (
    student_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid) and p.role::text in ('student', 'community_member')
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
  _uid uuid := auth.uid()::uuid;
  _role text;
  _thread_id uuid;
begin
  if _uid is null then raise exception 'Please sign in to create a conversation.'; end if;
  if nullif(btrim(_title), '') is null or length(btrim(_title)) > 120 then
    raise exception 'Enter a conversation title of 1 to 120 characters.';
  end if;
  if nullif(btrim(_body), '') is null or length(btrim(_body)) > 10000 then
    raise exception 'Enter a first message of 1 to 10000 characters.';
  end if;
  select role::text into _role from public.profiles where id = _uid;
  if _role in ('student', 'community_member') then
    insert into public.threads (student_id, created_by, title, visibility)
    values (_uid, _uid, btrim(_title), 'private')
    returning id into _thread_id;
  elsif _role = 'counselor' then
    if _student_id is null or not exists (
      select 1 from public.profiles where id = _student_id and role::text in ('student', 'community_member')
    ) then
      raise exception 'Choose a valid BSC community member for this conversation.';
    end if;
    insert into public.threads (student_id, counselor_id, created_by, title, visibility, shared_at)
    values (_student_id, _uid, _uid, btrim(_title), 'shared', now())
    returning id into _thread_id;
  else
    raise exception 'Only BSC community members and counselors can create conversations.';
  end if;
  insert into public.messages (thread_id, sender_id, body)
  values (_thread_id, _uid, btrim(_body));
  return _thread_id;
end;
$$;
revoke all on function public.create_conversation(text, text, uuid) from public, anon;
grant execute on function public.create_conversation(text, text, uuid) to authenticated;

create or replace function public.validate_referral_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is distinct from old.student_id
    or new.counselor_id is distinct from old.counselor_id then
    raise exception 'Referral participants cannot be changed.';
  end if;

  if old.student_id = auth.uid()::uuid
    and not public.is_counselor()
    and (to_jsonb(new) - 'status' - 'updated_at')
      is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Students can only update their referral status.';
  end if;

  if new.student_id is distinct from old.student_id
    or new.counselor_id is distinct from old.counselor_id
    or new.service_id is distinct from old.service_id
    or new.service_name is distinct from old.service_name
    or new.service_type is distinct from old.service_type
    or new.contact_details is distinct from old.contact_details
    or new.location is distinct from old.location
    or new.reason is distinct from old.reason
    or new.urgency is distinct from old.urgency
    or new.message is distinct from old.message then
    if not public.is_counselor() or old.counselor_id <> auth.uid()::uuid then
      raise exception 'Referral details can only be changed by the assigned counselor.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if public.is_counselor() and old.counselor_id = auth.uid()::uuid then
      if new.status not in ('sent', 'closed', 'seen', 'scheduled', 'completed') then
        raise exception 'Invalid referral status.';
      end if;
    elsif old.student_id = auth.uid()::uuid then
      if new.status not in ('seen', 'scheduled', 'completed') then
        raise exception 'Choose Seen, Scheduled, or Completed.';
      end if;
    else
      raise exception 'You cannot update this referral.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists validate_referral_update on public.referrals;
create trigger validate_referral_update
  before update on public.referrals
  for each row execute function public.validate_referral_update();

create or replace function public.notify_student_of_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.private_messages (student_id, sender_id, body, is_urgent, is_read, is_removed)
  values (
    new.student_id,
    new.counselor_id,
    'The Guidance Counselor has shared a referral for you.'
      || E'\n\nService or person: ' || new.service_name
      || case when new.service_type = '' then '' else E'\nType: ' || new.service_type end
      || case when new.contact_details = '' then '' else E'\nContact: ' || new.contact_details end
      || case when new.location = '' then '' else E'\nLocation: ' || new.location end
      || E'\nUrgency: ' || initcap(new.urgency)
      || case when new.message = '' then '' else E'\n\nA note from your counselor: ' || new.message end
      || case when new.follow_up_date is null then '' else E'\n\nSuggested follow-up: ' || new.follow_up_date::text end
      || E'\n\nYou can view and update this referral in your Referrals page.',
    new.urgency = 'urgent',
    false,
    false
  );
  return new;
end;
$$;
drop trigger if exists notify_student_of_referral on public.referrals;
create trigger notify_student_of_referral
  after insert on public.referrals
  for each row execute function public.notify_student_of_referral();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role text;
  _public_name text;
  _position text;
  _pen_name text;
  _avatar_id text;
  _choices jsonb;
  _version text;
  _role_type text;
begin
  _role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'student');
  if _role <> 'student' then _role := 'student'; end if;
  _pen_name := nullif(btrim(new.raw_user_meta_data ->> 'pen_name'), '');
  _avatar_id := coalesce(nullif(new.raw_user_meta_data ->> 'avatar_id', ''), 'lavender-cat');
  _public_name := _pen_name;
  _position := 'Student';
  _choices := new.raw_user_meta_data -> 'consent_choices';
  _version := nullif(new.raw_user_meta_data ->> 'consent_version', '');

  if _role = 'student' and (
    _pen_name is null or not public.is_valid_pen_name(_pen_name)
  ) then
    raise exception 'Choose a unique, appropriate pen name that is 3–32 characters.';
  end if;
  if _avatar_id not in ('lavender-cat', 'sleepy-bear', 'soft-fox', 'cloud-bunny',
    'little-owl', 'sunny-flower', 'tiny-cactus', 'moon-panda') then
    raise exception 'Choose an avatar from the available collection.';
  end if;
  if _version is null or not (
    _choices -> 'purpose' = 'true'::jsonb
    and _choices -> 'voluntary' = 'true'::jsonb
    and _choices -> 'identity_protection' = 'true'::jsonb
    and _choices -> 'publication_review' = 'true'::jsonb
    and _choices -> 'referral_sharing' = 'true'::jsonb
    and coalesce(_choices -> 'public_release', 'false'::jsonb) in ('true'::jsonb, 'false'::jsonb)
  ) then
    raise exception 'Please accept the required MenTalks consent statements before signing up.';
  end if;

  select format('%I.%I', n.nspname, t.typname) into _role_type
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'role'
    and not a.attisdropped;

  execute format(
    'insert into public.profiles (id, student_id, birthdate, role, position, pen_name, public_name, avatar_id)
     values ($1, $2, $3, $4::%s, $5, $6, $7, $8)
     on conflict (id) do nothing',
    _role_type
  )
  using new.id,
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'birthdate', '')::date,
    _role,
    _position,
    _pen_name,
    _public_name,
    _avatar_id;

  insert into public.profile_private (user_id, student_id, birthdate)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'birthdate', '')::date
  )
  on conflict (user_id) do nothing;

  insert into public.consent_records (user_id, version, event_type, choices)
  values (new.id, _version, 'accepted', _choices);
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_private' and column_name = 'real_name'
  ) then
    execute 'update public.profile_private set real_name = null';
    alter table public.profile_private drop column real_name;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_private' and column_name = 'nickname'
  ) then
    execute 'update public.profile_private set nickname = null';
    alter table public.profile_private drop column nickname;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname'
  ) then
    execute 'update public.profiles set nickname = null';
    alter table public.profiles drop column nickname;
  end if;
end;
$$;

create or replace function public.assign_counselor_profile(_user_id uuid, _public_name text, _position text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Only an administrator can assign counselor access.';
  end if;
  update public.profiles
    set role = 'counselor',
        public_name = btrim(_public_name),
        position = coalesce(nullif(btrim(_position), ''), 'Guidance Counselor')
  where id = _user_id;
  if not found then raise exception 'Profile not found.'; end if;
end;
$$;
revoke all on function public.assign_counselor_profile(uuid, text, text) from public, anon, authenticated;
grant execute on function public.assign_counselor_profile(uuid, text, text) to service_role;
