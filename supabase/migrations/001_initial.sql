-- ============================================================
-- Mentalks Database Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends auth.users)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  student_id    text,
  birthdate     date,
  nickname      text not null,
  role          text not null default 'student' check (role in ('student','counselor','moderator')),
  is_restricted boolean not null default false,
  restricted_until timestamptz,
  created_at    timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Counselors/Moderators can read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('counselor','moderator'))
);

-- 2. Threads
create table if not exists public.threads (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  visibility text not null default 'private' check (visibility in ('private','shared')),
  shared_at  timestamptz,
  created_at timestamptz default now()
);
alter table public.threads enable row level security;
create policy "Students see own threads" on public.threads for select using (auth.uid() = student_id);
create policy "Students insert own threads" on public.threads for insert with check (auth.uid() = student_id);
create policy "Students update own threads" on public.threads for update using (auth.uid() = student_id);
create policy "Counselors see shared threads" on public.threads for select using (
  visibility = 'shared' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor')
);

-- 3. Messages
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy "Thread participants can read messages" on public.messages for select using (
  exists (
    select 1 from public.threads t where t.id = thread_id and (
      t.student_id = auth.uid() or
      (t.visibility = 'shared' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'))
    )
  )
);
create policy "Thread participants can insert messages" on public.messages for insert with check (
  exists (
    select 1 from public.threads t where t.id = thread_id and (
      t.student_id = auth.uid() or
      (t.visibility = 'shared' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'))
    )
  )
);

-- 4. Appointments
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  counselor_id uuid references public.profiles(id),
  requested_at timestamptz not null,
  status       text not null default 'pending' check (status in ('pending','confirmed','declined')),
  notes        text,
  created_at   timestamptz default now()
);
alter table public.appointments enable row level security;
create policy "Students see own appointments" on public.appointments for select using (auth.uid() = student_id);
create policy "Students insert own appointments" on public.appointments for insert with check (auth.uid() = student_id);
create policy "Counselors see all appointments" on public.appointments for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor')
);
create policy "Counselors update appointment status" on public.appointments for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor')
);

-- 5. Focus groups
create table if not exists public.focus_groups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  created_at  timestamptz default now()
);
alter table public.focus_groups enable row level security;
create policy "Anyone authenticated can read focus groups" on public.focus_groups for select using (auth.uid() is not null);

-- 6. Focus group members
create table if not exists public.focus_group_members (
  group_id uuid not null references public.focus_groups(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);
alter table public.focus_group_members enable row level security;
create policy "Users see own memberships" on public.focus_group_members for select using (auth.uid() = user_id);
create policy "Users manage own memberships" on public.focus_group_members for insert with check (auth.uid() = user_id);
create policy "Users can leave groups" on public.focus_group_members for delete using (auth.uid() = user_id);

-- 7. Focus group posts
create table if not exists public.focus_group_posts (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references public.focus_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body      text not null,
  is_hidden boolean not null default false,
  created_at timestamptz default now()
);
alter table public.focus_group_posts enable row level security;
create policy "Members can read group posts" on public.focus_group_posts for select using (
  exists (select 1 from public.focus_group_members m where m.group_id = focus_group_posts.group_id and m.user_id = auth.uid())
);
create policy "Members can post" on public.focus_group_posts for insert with check (
  auth.uid() = author_id and
  exists (select 1 from public.focus_group_members m where m.group_id = focus_group_posts.group_id and m.user_id = auth.uid())
);
create policy "Moderators can update posts" on public.focus_group_posts for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'moderator')
);

-- 8. Post reports
create table if not exists public.post_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.focus_group_posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      text not null,
  reviewed    boolean not null default false,
  created_at  timestamptz default now()
);
alter table public.post_reports enable row level security;
create policy "Users can insert reports" on public.post_reports for insert with check (auth.uid() = reporter_id);
create policy "Moderators can see all reports" on public.post_reports for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'moderator')
);
create policy "Moderators can update reports" on public.post_reports for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'moderator')
);

-- 9. User warnings
create table if not exists public.user_warnings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  reason     text not null,
  created_at timestamptz default now()
);
alter table public.user_warnings enable row level security;
create policy "Moderators can manage warnings" on public.user_warnings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'moderator')
);

-- 10. Support banner
create table if not exists public.support_banner (
  id        serial primary key,
  content   text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz default now()
);
alter table public.support_banner enable row level security;
create policy "Anyone can read active banner" on public.support_banner for select using (true);
create policy "Counselors can manage banner" on public.support_banner for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('counselor','moderator'))
);

-- Sample focus groups
insert into public.focus_groups (title, description) values
  ('Stress & Anxiety', 'A safe space to share and discuss stress and anxiety management strategies.'),
  ('Academic Pressure', 'For students dealing with academic pressure and burnout.'),
  ('Friendship & Relationships', 'Discuss challenges in friendships, family, and relationships.'),
  ('Mindfulness & Self-Care', 'Share mindfulness tips and self-care practices.');
