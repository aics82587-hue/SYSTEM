-- Validate new and changed IDs without blocking updates to existing legacy profiles.
create or replace function public.validate_student_id_format()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id is null or new.student_id !~ '^[0-9]{4}-[0-9]+-AB$' then
    raise exception 'Student ID must use the format YYYY-number-AB.';
  end if;

  return new;
end;
$$;

create trigger profiles_validate_student_id
  before insert or update of student_id on public.profiles
  for each row execute function public.validate_student_id_format();

-- A student ID can only belong to one account.
create unique index profiles_student_id_unique
  on public.profiles (student_id)
  where student_id is not null;
