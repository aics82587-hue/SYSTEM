alter table public.profiles
  add column if not exists birthdate date;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, student_id, birthdate, nickname, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'student_id', ''),
    nullif(new.raw_user_meta_data ->> 'birthdate', '')::date,
    coalesce(nullif(new.raw_user_meta_data ->> 'nickname', ''), 'Student'),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, student_id, birthdate, nickname, role)
select
  id,
  nullif(raw_user_meta_data ->> 'student_id', ''),
  nullif(raw_user_meta_data ->> 'birthdate', '')::date,
  coalesce(nullif(raw_user_meta_data ->> 'nickname', ''), 'Student'),
  'student'
from auth.users
on conflict (id) do nothing;
