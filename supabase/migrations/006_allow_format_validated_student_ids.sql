-- Student IDs are validated by format and uniqueness, not by a registrar CSV.
-- Remove any profiles.student_id foreign key that still requires a registrar row.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint as constraint_row
    join pg_class as profiles_table
      on profiles_table.oid = constraint_row.conrelid
    join pg_namespace as profiles_schema
      on profiles_schema.oid = profiles_table.relnamespace
    join pg_class as registrar_table
      on registrar_table.oid = constraint_row.confrelid
    join pg_namespace as registrar_schema
      on registrar_schema.oid = registrar_table.relnamespace
    join pg_attribute as student_id_column
      on student_id_column.attrelid = profiles_table.oid
      and student_id_column.attnum = any(constraint_row.conkey)
    where constraint_row.contype = 'f'
      and profiles_schema.nspname = 'public'
      and profiles_table.relname = 'profiles'
      and student_id_column.attname = 'student_id'
      and registrar_schema.nspname = 'public'
      and registrar_table.relname = 'registrar_students'
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;
