-- ============================================================
-- Gelato Brief — database schema (run once in Supabase SQL editor)
-- Tables: briefs / answers / voices / links / admins  + RLS.
-- Writes happen ONLY through Edge Functions (service role bypasses RLS).
-- Admins (whitelisted emails) get read access for the admin panel.
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists briefs (
    id           uuid primary key default gen_random_uuid(),
    account_id   text not null unique,            -- 'tg_<id>'
    tg_user_id   bigint,
    tg_username  text,
    tg_name      text,
    contact_name text,
    email        text,
    phone        text,
    socials      text,
    status       text not null default 'in_progress',  -- in_progress | submitted
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    submitted_at timestamptz
);

-- contact fields (safe to re-run on an existing DB)
alter table briefs
    add column if not exists contact_name text,
    add column if not exists email        text,
    add column if not exists phone        text,
    add column if not exists socials      text;

create table if not exists answers (
    id         uuid primary key default gen_random_uuid(),
    brief_id   uuid not null references briefs(id) on delete cascade,
    q_num      int  not null,
    title      text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (brief_id, q_num)
);

create table if not exists voices (
    id             uuid primary key default gen_random_uuid(),
    brief_id       uuid not null references briefs(id) on delete cascade,
    answer_id      uuid not null references answers(id) on delete cascade,
    storage_path   text not null,
    mime           text,
    duration       real,
    transcript     text,
    transcribed_at timestamptz,
    created_at     timestamptz not null default now()
);

create table if not exists links (
    id         uuid primary key default gen_random_uuid(),
    brief_id   uuid not null references briefs(id) on delete cascade,
    answer_id  uuid not null references answers(id) on delete cascade,
    url        text not null,
    kind       text not null default 'link',      -- link | video
    created_at timestamptz not null default now()
);

create table if not exists admins (
    email    text primary key,
    added_at timestamptz not null default now()
);

create index if not exists idx_answers_brief on answers(brief_id);
create index if not exists idx_voices_brief  on voices(brief_id);
create index if not exists idx_voices_answer on voices(answer_id);
create index if not exists idx_links_brief   on links(brief_id);

-- updated_at touch
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_briefs_touch on briefs;
create trigger trg_briefs_touch  before update on briefs  for each row execute function touch_updated_at();
drop trigger if exists trg_answers_touch on answers;
create trigger trg_answers_touch before update on answers for each row execute function touch_updated_at();

-- ============ RLS ============
alter table briefs  enable row level security;
alter table answers enable row level security;
alter table voices  enable row level security;
alter table links   enable row level security;
alter table admins  enable row level security;

create or replace function is_admin() returns boolean language sql stable as $$
    select exists (select 1 from admins a where a.email = (auth.jwt() ->> 'email'));
$$;

-- read-only access for whitelisted admins (no anon writes — Edge Functions use service role)
create policy "admin read briefs"  on briefs  for select using (is_admin());
create policy "admin read answers" on answers for select using (is_admin());
create policy "admin read voices"  on voices  for select using (is_admin());
create policy "admin read links"   on links   for select using (is_admin());
create policy "self admin row"     on admins  for select using (email = (auth.jwt() ->> 'email'));

-- ============ Storage policy ============
-- Create a PRIVATE bucket named 'voices' in the dashboard first, then this lets
-- admins generate signed URLs / read objects. (Edge Functions bypass via service role.)
create policy "admin read voice objects" on storage.objects for select
    using (bucket_id = 'voices' and is_admin());

-- Add your team emails:
-- insert into admins (email) values ('you@example.com');
