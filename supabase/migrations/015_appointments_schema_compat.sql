begin;

alter table public.appointments
  add column if not exists requested_at timestamptz;

alter table public.appointments
  add column if not exists notes text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'appointments'
      and column_name = 'scheduled_at'
  ) then
    execute '
      update public.appointments
      set requested_at = scheduled_at
      where requested_at is null
        and scheduled_at is not null
    ';
  end if;

  if exists (
    select 1
    from public.appointments
    where requested_at is null
  ) then
    raise exception 'Cannot require appointments.requested_at: existing rows have no requested_at or scheduled_at value.';
  end if;
end;
$$;

alter table public.appointments
  alter column requested_at set not null;

notify pgrst, 'reload schema';
commit;
