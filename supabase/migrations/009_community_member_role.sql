-- Add the general BSC community account role.
-- Run this migration and commit it before running 010, because PostgreSQL
-- requires a transaction boundary after adding an enum value.
do $$
declare
  _role_type oid;
  _kind "char";
  _constraint_name text;
begin
  select a.atttypid, t.typtype
    into _role_type, _kind
  from pg_attribute a
  join pg_type t on t.oid = a.atttypid
  where a.attrelid = 'public.profiles'::regclass
    and a.attname = 'role'
    and not a.attisdropped;

  if _role_type is null then
    raise exception 'Could not find public.profiles.role.';
  end if;

  if _kind = 'e' then
    execute format('alter type %s add value if not exists %L', _role_type::regtype, 'moderator');
    execute format('alter type %s add value if not exists %L', _role_type::regtype, 'community_member');
  else
    for _constraint_name in
      select c.conname
      from pg_constraint c
      where c.conrelid = 'public.profiles'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ~* '\mrole\M'
    loop
      execute format('alter table public.profiles drop constraint %I', _constraint_name);
    end loop;

    alter table public.profiles
      add constraint profiles_role_check
      check (role::text in ('student', 'counselor', 'moderator', 'community_member'))
      not valid;
    alter table public.profiles validate constraint profiles_role_check;
  end if;
end;
$$;
