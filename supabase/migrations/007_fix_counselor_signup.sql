-- ============================================================
-- Migration 007: Fix counselor signup
-- Problems fixed:
--   1. handle_new_user always set role='student' — now reads role from metadata
--   2. validate_student_id_format raised exception for NULL student_id — 
--      counselors have no student_id so this blocked their signup
--   3. handle_new_user used 'Student' as default nickname for all users —
--      now uses full_name for counselors
-- ============================================================

-- ── Fix 1 & 3: Update handle_new_user trigger function ──────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _role     text;
  _nickname text;
begin
  -- Read role from metadata; default to 'student' for safety
  _role := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'student');

  -- Only allow known roles; reject anything else back to student
  if _role not in ('student', 'counselor') then
    _role := 'student';
  end if;

  -- Determine display name
  if _role = 'counselor' then
    _nickname := coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      'Counselor'
    );
  else
    _nickname := coalesce(
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      'Student'
    );
  end if;

  insert into public.profiles (id, student_id, birthdate, nickname, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'birthdate', '')::date,
    _nickname,
    _role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recreate the trigger (drop + create to pick up new function body)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── Fix 2: Allow NULL student_id for counselors ─────────────
-- The old trigger raised an exception whenever student_id was NULL,
-- which blocked ALL counselor signups. Now it only validates
-- when student_id is actually provided.
create or replace function public.validate_student_id_format()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Skip validation entirely when student_id is not supplied
  if new.student_id is null then
    return new;
  end if;

  -- Enforce format only when a value is present
  if new.student_id !~ '^[0-9]{4}-[0-9]+-AB$' then
    raise exception 'Student ID must use the format YYYY-number-AB.';
  end if;

  return new;
end;
$$;
-- The trigger itself (profiles_validate_student_id) already exists and
-- points to this function, so no need to recreate it.
