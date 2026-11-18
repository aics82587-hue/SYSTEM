create or replace function public.current_user_can_read_all_profiles()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('counselor', 'moderator')
  );
$$;

drop policy if exists "Counselors/Moderators can read all profiles" on public.profiles;
create policy "Counselors/Moderators can read all profiles"
  on public.profiles
  for select
  using (public.current_user_can_read_all_profiles());
