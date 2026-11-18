-- ============================================================
-- Mentalks Phase 2 Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Counselor Status ──────────────────────────────────────
-- Tracks the counselor's current availability and presence status.
create table if not exists public.counselor_status (
  id           uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'available'
                 check (status in ('available','in_consultation','away','not_in_office','online_only')),
  reason       text,       -- e.g. "Faculty meeting", "Comfort room break"
  updated_at   timestamptz default now(),
  unique (counselor_id)   -- one row per counselor
);
alter table public.counselor_status enable row level security;
-- Everyone authenticated can read counselor status (students need it on their dashboard)
create policy "Anyone authenticated can read counselor status"
  on public.counselor_status for select
  using (auth.uid() is not null);
-- Only the counselor can update her own status
create policy "Counselor can upsert own status"
  on public.counselor_status for all
  using (auth.uid() = counselor_id)
  with check (auth.uid() = counselor_id);


-- ── 2. Consultation Queue ────────────────────────────────────
-- Message-based queue: first to message = first in line.
-- Urgent flag moves student to top of active queue.
create table if not exists public.consultation_queue (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  counselor_id uuid references public.profiles(id),
  is_urgent    boolean not null default false,
  status       text not null default 'waiting'
                 check (status in ('waiting','active','done','cancelled')),
  position     integer,   -- computed/materialized; updated by trigger or server logic
  entered_at   timestamptz default now(),
  resolved_at  timestamptz,
  unique (student_id, status) -- prevent duplicate active/waiting entries per student
);
alter table public.consultation_queue enable row level security;
create policy "Students see own queue entry"
  on public.consultation_queue for select
  using (auth.uid() = student_id);
create policy "Students insert own queue entry"
  on public.consultation_queue for insert
  with check (auth.uid() = student_id);
create policy "Students update own queue entry (cancel)"
  on public.consultation_queue for update
  using (auth.uid() = student_id);
create policy "Counselors see all queue entries"
  on public.consultation_queue for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'));
create policy "Counselors update queue entries"
  on public.consultation_queue for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'));


-- ── 3. Private Messages (Student ↔ Counselor) ───────────────
-- One conversation thread per student; ordered oldest-first for counselor.
-- Urgent messages are surfaced at the top of counselor's inbox.
create table if not exists public.private_messages (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  body         text,                -- nullable if voice-only message
  voice_url    text,               -- Supabase Storage signed URL
  is_urgent    boolean not null default false,
  urgent_acknowledged boolean not null default false,
  flag_color   text check (flag_color in ('yellow','orange','red')),
  is_removed   boolean not null default false,  -- counselor clicked "Ignore"
  is_read      boolean not null default false,
  created_at   timestamptz default now(),
  constraint body_or_voice check (body is not null or voice_url is not null)
);
alter table public.private_messages enable row level security;
create policy "Students see own private messages"
  on public.private_messages for select
  using (auth.uid() = student_id);
create policy "Students insert own private messages"
  on public.private_messages for insert
  with check (auth.uid() = sender_id and auth.uid() = student_id);
create policy "Counselors see all private messages"
  on public.private_messages for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'));
create policy "Counselors insert replies"
  on public.private_messages for insert
  with check (
    auth.uid() = sender_id and
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor')
  );
create policy "Counselors update messages (flag/ignore/read)"
  on public.private_messages for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'));
-- Urgent message logs (audit trail for misuse)
create table if not exists public.urgent_message_logs (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.private_messages(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  logged_at    timestamptz default now()
);
alter table public.urgent_message_logs enable row level security;
create policy "Counselors see urgent logs"
  on public.urgent_message_logs for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'counselor'));
create policy "Students insert urgent logs for own messages"
  on public.urgent_message_logs for insert
  with check (auth.uid() = student_id);


-- ── 4. Group Chats ───────────────────────────────────────────
-- Group chats
create table if not exists public.group_chats (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- Create the membership table before any policies reference it.
create table if not exists public.group_chat_members (
  chat_id      uuid not null references public.group_chats(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  is_counselor boolean not null default false,
  joined_at    timestamptz default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.group_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.group_chats(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text,
  voice_url  text,
  visible_to uuid[] not null default '{}',
  created_at timestamptz default now(),
  constraint body_or_voice check (body is not null or voice_url is not null)
);

alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_chat_messages enable row level security;

-- Checks whether the current user belongs to a chat without recursive RLS.
create or replace function public.is_group_chat_member(_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_chat_members as m
    where m.chat_id = _chat_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_group_chat_member(uuid) from public, anon;
grant execute on function public.is_group_chat_member(uuid) to authenticated;

-- Make this section safe to rerun after a partial execution.
drop policy if exists "Members can see their group chats" on public.group_chats;
drop policy if exists "Students can create group chats" on public.group_chats;
drop policy if exists "Members see group membership" on public.group_chat_members;
drop policy if exists "Chat creator or counselor can add members" on public.group_chat_members;
drop policy if exists "Members can leave (non-counselor)" on public.group_chat_members;
drop policy if exists "Members can see messages visible to them" on public.group_chat_messages;
drop policy if exists "Members can send messages" on public.group_chat_messages;

create policy "Members can see their group chats"
  on public.group_chats for select to authenticated
  using (public.is_group_chat_member(group_chats.id));

create policy "Students can create group chats"
  on public.group_chats for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Members see group membership"
  on public.group_chat_members for select to authenticated
  using (public.is_group_chat_member(group_chat_members.chat_id));

create policy "Chat creator or counselor can add members"
  on public.group_chat_members for insert to authenticated
  with check (
    exists (
      select 1
      from public.group_chats as g
      where g.id = group_chat_members.chat_id
        and g.created_by = (select auth.uid())
    )
    or (
      public.is_group_chat_member(group_chat_members.chat_id)
      and exists (
        select 1
        from public.profiles as p
        where p.id = (select auth.uid())
          and p.role = 'counselor'
      )
    )
  );

create policy "Members can leave (non-counselor)"
  on public.group_chat_members for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and is_counselor = false
  );

create policy "Members can see messages visible to them"
  on public.group_chat_messages for select to authenticated
  using (
    (select auth.uid()) = any(visible_to)
    and public.is_group_chat_member(group_chat_messages.chat_id)
  );

create policy "Members can send messages"
  on public.group_chat_messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.is_group_chat_member(group_chat_messages.chat_id)
  );

-- ── 5. Consultation Slots / Calendar ─────────────────────────
-- Counselor sets daily slot limits; auto-marks as full/unavailable.
create table if not exists public.consultation_slots (
  id             uuid primary key default gen_random_uuid(),
  counselor_id   uuid not null references public.profiles(id) on delete cascade,
  slot_date      date not null,
  max_slots      integer not null default 8,
  booked_slots   integer not null default 0,
  is_blocked     boolean not null default false,
  block_reason   text,
  is_online_only boolean not null default false,  -- true for weekends/holidays
  created_at     timestamptz default now(),
  unique (counselor_id, slot_date)
);
alter table public.consultation_slots enable row level security;
create policy "Anyone authenticated can read slots"
  on public.consultation_slots for select
  using (auth.uid() is not null);
create policy "Counselors manage slots"
  on public.consultation_slots for all
  using (auth.uid() = counselor_id)
  with check (auth.uid() = counselor_id);


-- ── 6. Counselor Notes ───────────────────────────────────────
-- Private notes for the counselor only. Never visible to students.
create table if not exists public.counselor_notes (
  id           uuid primary key default gen_random_uuid(),
  counselor_id uuid not null references public.profiles(id) on delete cascade,
  student_id   uuid references public.profiles(id) on delete set null,
  title        text not null,
  body         text not null,
  tags         text[] not null default '{}',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.counselor_notes enable row level security;
create policy "Only counselor can access own notes"
  on public.counselor_notes for all
  using (auth.uid() = counselor_id)
  with check (auth.uid() = counselor_id);


-- ── 7. Freedom Wall Posts ────────────────────────────────────
-- Sticky notes visible to all authenticated students.
create table if not exists public.freedom_wall_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  content       text not null,
  sticky_color  text not null default '#FEF08A',   -- hex color
  paper_texture text not null default 'plain'
                  check (paper_texture in ('plain','lined','dotted','kraft','grid')),
  font_family   text not null default 'handwriting'
                  check (font_family in ('handwriting','print','script')),
  pos_x         float not null default 0,
  pos_y         float not null default 0,
  is_visible    boolean not null default true,
  created_at    timestamptz default now()
);
alter table public.freedom_wall_posts enable row level security;
create policy "All authenticated users can read visible posts"
  on public.freedom_wall_posts for select
  using (auth.uid() is not null and is_visible = true);
create policy "Students can insert own posts"
  on public.freedom_wall_posts for insert
  with check (auth.uid() = author_id);
create policy "Students can update own posts"
  on public.freedom_wall_posts for update
  using (auth.uid() = author_id);
create policy "Students can delete own posts"
  on public.freedom_wall_posts for delete
  using (auth.uid() = author_id);
create policy "Counselors/moderators can hide posts"
  on public.freedom_wall_posts for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('counselor','moderator'))
  );


-- ── 8. Enable Realtime for new tables ───────────────────────
-- Run these so Supabase Realtime channels work for live updates.
alter publication supabase_realtime add table public.counselor_status;
alter publication supabase_realtime add table public.consultation_queue;
alter publication supabase_realtime add table public.private_messages;
alter publication supabase_realtime add table public.group_chat_messages;
alter publication supabase_realtime add table public.consultation_slots;
alter publication supabase_realtime add table public.freedom_wall_posts;


-- ── 9. Storage Buckets (run separately or via Supabase Dashboard) ──
-- Create a private bucket for voice messages.
-- In Supabase Dashboard > Storage > New Bucket:
--   Name: voice-messages
--   Public: false
--   File size limit: 10 MB
--   Allowed MIME types: audio/webm, audio/ogg, audio/mp4, audio/mpeg
