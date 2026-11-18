-- Make dark the default and convert existing system preferences to dark.
-- Explicit light and dark selections are preserved.
alter table public.profiles
  alter column theme_preference set default 'dark';

update public.profiles
set theme_preference = 'dark'
where theme_preference = 'system';
