alter table public.appointments enable row level security;

drop policy if exists "Students see own appointments" on public.appointments;
create policy "Students see own appointments"
  on public.appointments for select to authenticated
  using (
    student_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'student'
    )
  );

drop policy if exists "Students insert own appointments" on public.appointments;
create policy "Students insert own appointments"
  on public.appointments for insert to authenticated
  with check (
    student_id = (select auth.uid()::uuid)
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()::uuid)
        and p.role::text = 'student'
    )
  );

drop policy if exists "Counselors see all appointments" on public.appointments;
create policy "Counselors see all appointments"
  on public.appointments for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid)
      and p.role::text = 'counselor'
  ));

drop policy if exists "Counselors update appointment status" on public.appointments;
create policy "Counselors update appointment status"
  on public.appointments for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid)
      and p.role::text = 'counselor'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()::uuid)
      and p.role::text = 'counselor'
  ));

revoke all on public.appointments from anon, authenticated;
grant select, insert on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;
