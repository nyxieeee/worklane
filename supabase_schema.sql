-- ==============================================================================
-- WORKLANE - FRESH RESET & COMPLETE DATABASE SCHEMA
-- ==============================================================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 2. DROP ALL EXISTING TABLES & OBJECTS (COMPLETE CLEAN RESET)
-- ==============================================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_board_member(text) cascade;

drop table if exists public.email_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.comments cascade;
drop table if exists public.attachments cascade;
drop table if exists public.custom_labels cascade;
drop table if exists public.card_labels cascade;
drop table if exists public.card_assignees cascade;
drop table if exists public.cards cascade;
drop table if exists public.columns cascade;
drop table if exists public.board_members cascade;
drop table if exists public.boards cascade;
drop table if exists public.profiles cascade;

-- ==============================================================================
-- 3. PROFILES TABLE (Linked to Supabase Auth)
-- ==============================================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text unique not null,
  avatar_url text,
  border_style text default 'none',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to automatically create or update profile upon auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (id) do update
  set
    name = coalesce(excluded.name, public.profiles.name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any already registered auth users
insert into public.profiles (id, name, email, avatar_url)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  email,
  coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
from auth.users
on conflict (id) do nothing;

-- ==============================================================================
-- 4. BOARDS TABLE
-- ==============================================================================
create table public.boards (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  color text default '#6366f1' not null,
  created_by text not null, -- User Email
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==============================================================================
-- 5. BOARD MEMBERS TABLE
-- ==============================================================================
create table public.board_members (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  color text default '#6366f1' not null,
  avatar_url text,
  border_style text default 'none',
  role text default 'member' not null,
  added_at timestamptz default now() not null,
  unique (board_id, email)
);

-- ==============================================================================
-- 6. COLUMNS TABLE
-- ==============================================================================
create table public.columns (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  name text not null,
  position integer default 0 not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 7. CARDS TABLE
-- ==============================================================================
create table public.cards (
  id text primary key default gen_random_uuid()::text,
  board_id text references public.boards(id) on delete cascade not null,
  column_id text references public.columns(id) on delete cascade,
  title text not null,
  description text default '' not null,
  priority text default 'medium' not null, -- 'low', 'medium', 'high', 'urgent'
  completed boolean default false not null,
  completed_at timestamptz,
  due_date timestamptz,
  cover_attachment_id text,
  position integer default 0 not null,
  is_inbox boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ==============================================================================
-- 8. CARD ASSIGNEES TABLE
-- ==============================================================================
create table public.card_assignees (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  member_id text not null,
  assigned_at timestamptz default now() not null,
  unique (card_id, member_id)
);

-- ==============================================================================
-- 9. CARD LABELS TABLE
-- ==============================================================================
create table public.card_labels (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  label_id text not null,
  unique (card_id, label_id)
);

-- ==============================================================================
-- 10. CUSTOM LABELS TABLE
-- ==============================================================================
create table public.custom_labels (
  id text primary key default gen_random_uuid()::text,
  user_email text,
  name text not null,
  color text default '#3b82f6' not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 11. ATTACHMENTS TABLE
-- ==============================================================================
create table public.attachments (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  name text not null,
  size bigint default 0 not null,
  type text default 'application/octet-stream' not null,
  data_url text,
  storage_path text,
  added_at timestamptz default now() not null
);

-- ==============================================================================
-- 12. COMMENTS TABLE
-- ==============================================================================
create table public.comments (
  id text primary key default gen_random_uuid()::text,
  card_id text references public.cards(id) on delete cascade not null,
  parent_id text references public.comments(id) on delete cascade,
  reply_to_author text,
  author text not null,
  author_initials text not null,
  avatar_color text default '#6366f1' not null,
  text text not null,
  created_at timestamptz default now() not null
);

-- ==============================================================================
-- 13. NOTIFICATIONS TABLE
-- ==============================================================================
create table public.notifications (
  id text primary key default gen_random_uuid()::text,
  recipient_email text not null,
  recipient_id uuid references auth.users(id) on delete set null,
  title text not null,
  sub text not null,
  icon text default 'bell' not null,
  card_id text,
  board_id text,
  time timestamptz default now() not null,
  is_read boolean default false not null
);

-- ==============================================================================
-- 14. EMAIL NOTIFICATION LOGS TABLE
-- ==============================================================================
create table public.email_logs (
  id text primary key default gen_random_uuid()::text,
  recipient_email text not null,
  recipient_name text not null,
  subject text not null,
  body text not null,
  status text default 'sent' not null,
  event_type text not null,
  sent_at timestamptz default now() not null
);

-- ==============================================================================
-- 15. PERFORMANCE INDICES
-- ==============================================================================
create index if not exists idx_boards_created_by on public.boards(created_by);
create index if not exists idx_board_members_board_id on public.board_members(board_id);
create index if not exists idx_board_members_email on public.board_members(email);
create index if not exists idx_columns_board_id on public.columns(board_id);
create index if not exists idx_cards_board_id on public.cards(board_id);
create index if not exists idx_cards_column_id on public.cards(column_id);
create index if not exists idx_card_assignees_card_id on public.card_assignees(card_id);
create index if not exists idx_card_labels_card_id on public.card_labels(card_id);
create index if not exists idx_attachments_card_id on public.attachments(card_id);
create index if not exists idx_comments_card_id on public.comments(card_id);
create index if not exists idx_notifs_recipient on public.notifications(recipient_email);

-- ==============================================================================
-- 16. ROW LEVEL SECURITY (RLS) - PERMISSIVE FOR AUTHENTICATED TEAM USERS
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.card_assignees enable row level security;
alter table public.card_labels enable row level security;
alter table public.custom_labels enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.email_logs enable row level security;

-- Policies for Workspace Collaborators & Public Anon Access
create policy "Allow all access to profiles" on public.profiles
  for all using (true) with check (true);

create policy "Allow all access to boards" on public.boards
  for all using (true) with check (true);

create policy "Allow all access to board_members" on public.board_members
  for all using (true) with check (true);

create policy "Allow all access to columns" on public.columns
  for all using (true) with check (true);

create policy "Allow all access to cards" on public.cards
  for all using (true) with check (true);

create policy "Allow all access to card_assignees" on public.card_assignees
  for all using (true) with check (true);

create policy "Allow all access to card_labels" on public.card_labels
  for all using (true) with check (true);

create policy "Allow all access to custom_labels" on public.custom_labels
  for all using (true) with check (true);

create policy "Allow all access to attachments" on public.attachments
  for all using (true) with check (true);

create policy "Allow all access to comments" on public.comments
  for all using (true) with check (true);

create policy "Allow all access to notifications" on public.notifications
  for all using (true) with check (true);

create policy "Allow all access to email_logs" on public.email_logs
  for all using (true) with check (true);

-- ==============================================================================
-- 17. ENABLE REALTIME REPLICATION & REPLICA IDENTITY (Safe & Idempotent)
-- ==============================================================================
do $$
declare
  tbl text;
  tables text[] := array[
    'boards',
    'board_members',
    'columns',
    'cards',
    'card_assignees',
    'card_labels',
    'comments',
    'attachments',
    'notifications',
    'custom_labels',
    'profiles'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach tbl in array tables
  loop
    -- Ensure replica identity full so UPDATE and DELETE emit full row data for Realtime & RLS
    execute format('alter table public.%I replica identity full', tbl);

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;

-- ==============================================================================
-- 18. STORAGE BUCKET FOR ATTACHMENTS
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  true,
  52428800, -- 50MB
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'text/plain', 'application/zip']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

-- Storage Policies for Attachments
drop policy if exists "Authenticated Uploads" on storage.objects;
create policy "Authenticated Uploads" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

drop policy if exists "Public/Authenticated Reads" on storage.objects;
create policy "Public/Authenticated Reads" on storage.objects
  for select using (bucket_id = 'attachments');

drop policy if exists "Authenticated Deletes" on storage.objects;
create policy "Authenticated Deletes" on storage.objects
  for delete using (bucket_id = 'attachments' and auth.role() = 'authenticated');

-- ==============================================================================
-- 19. ACCOUNT DELETION & DEACTIVATION RPC
-- ==============================================================================
create or replace function public.delete_user_account()
returns void as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  select email into v_email from auth.users where id = v_user_id;
  
  -- 1. Remove user from board memberships
  if v_email is not null then
    delete from public.board_members where email ilike v_email;
    delete from public.notifications where recipient_email ilike v_email;
  end if;
  
  -- 2. Delete user profile record
  delete from public.profiles where id = v_user_id;
  
  -- 3. Delete user from auth.users
  delete from auth.users where id = v_user_id;
end;
$$ language plpgsql security definer;


-- ==============================================================================
-- 20. MIGRATION — Add border_style columns (run if upgrading an existing DB)
-- ==============================================================================
-- Run these ALTER TABLE statements if you already have the tables and just need
-- to add the new border_style column (safe to run on existing databases):
--
-- alter table public.profiles add column if not exists border_style text default 'none';
-- alter table public.board_members add column if not exists border_style text default 'none';
--

-- ==============================================================================
-- 21. REALTIME REPLICATION (Instant Realtime Sync across all browsers/devices)
-- ==============================================================================
-- Enable Realtime publication so Postgres WAL changes are broadcast over WebSockets:
do $$
begin
  alter publication supabase_realtime add table public.boards;
  alter publication supabase_realtime add table public.board_members;
  alter publication supabase_realtime add table public.columns;
  alter publication supabase_realtime add table public.cards;
  alter publication supabase_realtime add table public.card_assignees;
  alter publication supabase_realtime add table public.card_labels;
  alter publication supabase_realtime add table public.comments;
  alter publication supabase_realtime add table public.attachments;
  alter publication supabase_realtime add table public.custom_labels;
  alter publication supabase_realtime add table public.profiles;
  alter publication supabase_realtime add table public.notifications;
exception when others then
  null; -- Ignore if tables are already added or publication already exists
end;
$$;


