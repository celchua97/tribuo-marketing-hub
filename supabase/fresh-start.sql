-- FRESH START for the Tribuo board and Idea Bank.
-- Wipes everything in this project's "public" area and rebuilds it from scratch,
-- so it works no matter which earlier steps were skipped. Only run it in the
-- Supabase project made for this board, and only while it holds no real entries.

drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant all on functions to postgres, service_role;
alter default privileges in schema public grant all on sequences to postgres, service_role;

-- ==== migrations/0001_init.sql ====
-- Tribuo content board: core schema
-- Chain: Brief (lead) -> Shoot (videographer) -> Edit (editor) -> Approve (lead) -> Posted
--
-- Rules that matter live in the database, not the UI:
--   * status only changes through the transition functions at the bottom of this file
--   * the assignee (whose list a video is on) and the due date are recalculated by a
--     trigger on every write, so handover is always automatic
--   * every status change is written to video_events (history, and a future
--     WhatsApp/Telegram integration can read from it)

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('lead', 'videographer', 'editor');
create type public.market as enum ('MY', 'KH');
create type public.video_status as enum (
  'draft',             -- planned, brief not written yet (lead)
  'to_shoot',          -- brief ready, waiting to be shot (videographer)
  'to_edit',           -- shot, waiting for first edit (editor)
  'in_review',         -- submitted, waiting for approval (lead)
  'changes_requested', -- feedback given, waiting for fixes (editor)
  'approved',          -- approved, waiting to go live (lead)
  'posted'             -- done
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null,
  market public.market,                                -- null = covers both markets
  timezone text not null default 'Asia/Kuala_Lumpur',
  whatsapp_number text,                                -- for a future messaging integration
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only invited emails can sign in. A row here is turned into a profile the first
-- time that person requests a magic link.
create table public.team_invites (
  email text primary key check (email = lower(email)),
  full_name text not null,
  role public.user_role not null,
  market public.market,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings and reference data
-- ---------------------------------------------------------------------------
create table public.settings (
  id boolean primary key default true check (id),     -- single row
  edit_due_days int not null default 3 check (edit_due_days between 0 and 30),
  approval_due_days int not null default 1 check (approval_due_days between 0 and 30),
  revision_due_days int not null default 2 check (revision_due_days between 0 and 30),
  team_timezone text not null default 'Asia/Kuala_Lumpur'
);
insert into public.settings default values;

create table public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.brief_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  brief text not null,
  sort_order int not null default 0
);

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market public.market not null,
  active boolean not null default true,
  unique (name, market)
);

create table public.shoot_days (
  id uuid primary key default gen_random_uuid(),
  shoot_date date not null,
  market public.market not null,
  studio_id uuid references public.studios (id) on delete set null,
  videographer_id uuid references public.profiles (id) on delete set null,
  footage_link text,
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Videos
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  market public.market not null,
  pillar_id uuid references public.content_pillars (id) on delete set null,
  episode_number int check (episode_number > 0),
  brief text,
  reference_link text,
  target_post_date date,

  status public.video_status not null default 'draft',
  status_changed_at timestamptz not null default now(),
  assignee_id uuid references public.profiles (id) on delete set null,  -- whose list it is on
  due_on date,                                                          -- calculated

  shoot_day_id uuid references public.shoot_days (id) on delete set null,
  editor_id uuid references public.profiles (id) on delete set null,
  shot_at timestamptz,
  latest_drive_link text,
  posted_link text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_assignee_idx on public.videos (assignee_id) where status <> 'posted';
create index videos_status_idx on public.videos (status);
create index videos_shoot_day_idx on public.videos (shoot_day_id);

-- One row per "Ready for review" tap. The latest link is also copied to videos.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  round int not null,
  drive_link text not null,
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  unique (video_id, round)
);

-- One row per line of feedback. The editor ticks each one off.
create table public.feedback_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  submission_id uuid references public.submissions (id) on delete set null,
  timecode text check (timecode ~ '^[0-9]{1,2}:[0-5][0-9]$'),
  body text not null check (btrim(body) <> ''),
  position int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  needs_clarification boolean not null default false
);
create index feedback_comments_video_idx on public.feedback_comments (video_id);

-- Automatic history. Also the event source for future nudges/integrations.
create table public.video_events (
  id bigint generated always as identity primary key,
  video_id uuid not null references public.videos (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null,          -- created | status_changed | changes_requested | submitted
  from_status public.video_status,
  to_status public.video_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index video_events_video_idx on public.video_events (video_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create function public.is_lead() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'lead', false)
$$;

-- Default person for a role, preferring someone dedicated to the market.
create function public.default_member(p_role public.user_role, p_market public.market)
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles
  where role = p_role and active and (market is null or market = p_market)
  order by (market is null), created_at
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Handover: assignee + due date, recalculated on every write
-- ---------------------------------------------------------------------------
create function public.videos_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  sd shoot_days;
begin
  select * into s from settings where id;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.shot_at := null;
    new.latest_drive_link := null;
    new.posted_link := null;
  end if;

  -- Writing the brief moves a video from "brief to write" to "to shoot" (and back).
  if new.status in ('draft', 'to_shoot') then
    new.status := case when coalesce(btrim(new.brief), '') = '' then 'draft' else 'to_shoot' end;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.shoot_day_id is not null then
    select * into sd from shoot_days where id = new.shoot_day_id;
  end if;

  if new.status in ('to_edit', 'changes_requested') and new.editor_id is null then
    new.editor_id := default_member('editor', new.market);
  end if;

  new.assignee_id := case new.status
    when 'draft'             then default_member('lead', new.market)
    when 'to_shoot'          then coalesce(sd.videographer_id, default_member('videographer', new.market))
    when 'to_edit'           then new.editor_id
    when 'changes_requested' then new.editor_id
    when 'in_review'         then default_member('lead', new.market)
    when 'approved'          then default_member('lead', new.market)
    else null
  end;

  new.due_on := case new.status
    when 'to_shoot'          then sd.shoot_date
    when 'to_edit'           then (new.shot_at at time zone s.team_timezone)::date + s.edit_due_days
    when 'in_review'         then (new.status_changed_at at time zone s.team_timezone)::date + s.approval_due_days
    when 'changes_requested' then (new.status_changed_at at time zone s.team_timezone)::date + s.revision_due_days
    when 'approved'          then new.target_post_date
    else null
  end;

  new.updated_at := now();
  return new;
end $$;

create trigger videos_before_write
before insert or update on public.videos
for each row execute function public.videos_before_write();

create function public.videos_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into video_events (video_id, actor_id, kind, to_status)
    values (new.id, auth.uid(), 'created', new.status);
  elsif new.status is distinct from old.status then
    insert into video_events (video_id, actor_id, kind, from_status, to_status)
    values (new.id, auth.uid(), 'status_changed', old.status, new.status);
  end if;
  return null;
end $$;

create trigger videos_after_write
after insert or update on public.videos
for each row execute function public.videos_after_write();

-- When settings change, re-date everything in flight.
create function public.settings_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update videos set updated_at = now() where status not in ('draft', 'posted');
  return null;
end $$;

create trigger settings_after_update
after update on public.settings
for each statement execute function public.settings_after_update();

-- ---------------------------------------------------------------------------
-- Sign-up: invite only
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv team_invites;
begin
  select * into inv from team_invites where email = lower(new.email);
  if not found then
    raise exception 'not_invited: % is not on the team', new.email;
  end if;
  insert into profiles (id, email, full_name, role, market)
  values (new.id, lower(new.email), inv.full_name, inv.role, inv.market)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Transitions (the only way status changes)
-- ---------------------------------------------------------------------------
create function public.lock_video(p_video_id uuid) returns public.videos
language plpgsql security definer set search_path = public as $$
declare
  v videos;
begin
  if not is_member() then
    raise exception 'not_allowed: sign in first';
  end if;
  select * into v from videos where id = p_video_id for update;
  if not found then
    raise exception 'not_found: video not found';
  end if;
  return v;
end $$;

-- Videographer: "Shot"
create function public.mark_shot(p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v videos := lock_video(p_video_id);
begin
  if my_role() not in ('videographer', 'lead') then
    raise exception 'not_allowed: only the videographer can mark a video as shot';
  end if;
  if v.status <> 'to_shoot' then
    raise exception 'wrong_stage: this video is not waiting to be shot';
  end if;
  update videos set status = 'to_edit', shot_at = now() where id = p_video_id;
end $$;

-- Editor: paste Drive link + "Ready for review"
create function public.submit_for_review(p_video_id uuid, p_drive_link text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v videos := lock_video(p_video_id);
  next_round int;
  sub_id uuid;
begin
  if my_role() not in ('editor', 'lead') then
    raise exception 'not_allowed: only the editor can submit for review';
  end if;
  if v.status not in ('to_edit', 'changes_requested') then
    raise exception 'wrong_stage: this video is not being edited';
  end if;
  p_drive_link := btrim(coalesce(p_drive_link, ''));
  if p_drive_link !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'bad_link: paste a Google Drive link';
  end if;

  select coalesce(max(round), 0) + 1 into next_round from submissions where video_id = p_video_id;
  insert into submissions (video_id, round, drive_link, submitted_by)
  values (p_video_id, next_round, p_drive_link, auth.uid())
  returning id into sub_id;

  update videos
  set status = 'in_review',
      latest_drive_link = p_drive_link,
      editor_id = coalesce(editor_id, auth.uid())
  where id = p_video_id;

  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, auth.uid(), 'submitted',
          jsonb_build_object('round', next_round, 'drive_link', p_drive_link));
end $$;

-- Lead: "Approve"
create function public.approve_video(p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v videos := lock_video(p_video_id);
begin
  if not is_lead() then
    raise exception 'not_allowed: only Celine can approve';
  end if;
  if v.status <> 'in_review' then
    raise exception 'wrong_stage: this video is not waiting for approval';
  end if;
  update videos set status = 'approved' where id = p_video_id;
end $$;

-- Lead: "Request changes", one row per comment line
-- p_comments: [{"timecode": "0:12", "body": "..."}, ...]
create function public.request_changes(p_video_id uuid, p_comments jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v videos := lock_video(p_video_id);
  latest_sub uuid;
  c jsonb;
  n int := 0;
  tc text;
begin
  if not is_lead() then
    raise exception 'not_allowed: only Celine can request changes';
  end if;
  if v.status <> 'in_review' then
    raise exception 'wrong_stage: this video is not waiting for approval';
  end if;

  select id into latest_sub from submissions
  where video_id = p_video_id order by round desc limit 1;

  for c in select * from jsonb_array_elements(coalesce(p_comments, '[]'::jsonb)) loop
    if coalesce(btrim(c ->> 'body'), '') <> '' then
      tc := nullif(btrim(coalesce(c ->> 'timecode', '')), '');
      if tc is not null and tc !~ '^[0-9]{1,2}:[0-5][0-9]$' then
        raise exception 'bad_timecode: use m:ss, for example 0:12';
      end if;
      insert into feedback_comments (video_id, submission_id, timecode, body, position, created_by)
      values (p_video_id, latest_sub, tc, btrim(c ->> 'body'), n, auth.uid());
      n := n + 1;
    end if;
  end loop;

  if n = 0 then
    raise exception 'no_comments: add at least one comment';
  end if;

  update videos set status = 'changes_requested' where id = p_video_id;

  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, auth.uid(), 'changes_requested', jsonb_build_object('comments', n));
end $$;

-- Lead: "Posted"
create function public.mark_posted(p_video_id uuid, p_posted_link text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v videos := lock_video(p_video_id);
begin
  if not is_lead() then
    raise exception 'not_allowed: only Celine can mark a video as posted';
  end if;
  if v.status <> 'approved' then
    raise exception 'wrong_stage: this video has not been approved';
  end if;
  update videos
  set status = 'posted', posted_link = nullif(btrim(coalesce(p_posted_link, '')), '')
  where id = p_video_id;
end $$;

-- ---------------------------------------------------------------------------
-- Access: everyone on the team reads everything; only the lead edits plans.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.team_invites enable row level security;
alter table public.settings enable row level security;
alter table public.content_pillars enable row level security;
alter table public.brief_templates enable row level security;
alter table public.studios enable row level security;
alter table public.shoot_days enable row level security;
alter table public.videos enable row level security;
alter table public.submissions enable row level security;
alter table public.feedback_comments enable row level security;
alter table public.video_events enable row level security;

create policy "team reads profiles" on public.profiles for select to authenticated using (is_member());
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "lead edits profiles" on public.profiles for update to authenticated
  using (is_lead()) with check (is_lead());

create policy "lead manages invites" on public.team_invites for all to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads settings" on public.settings for select to authenticated using (is_member());
create policy "lead edits settings" on public.settings for update to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads pillars" on public.content_pillars for select to authenticated using (is_member());
create policy "lead manages pillars" on public.content_pillars for all to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads templates" on public.brief_templates for select to authenticated using (is_member());
create policy "lead manages templates" on public.brief_templates for all to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads studios" on public.studios for select to authenticated using (is_member());
create policy "lead manages studios" on public.studios for all to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads shoot days" on public.shoot_days for select to authenticated using (is_member());
create policy "lead manages shoot days" on public.shoot_days for all to authenticated
  using (is_lead()) with check (is_lead());

create policy "team reads videos" on public.videos for select to authenticated using (is_member());
create policy "lead creates videos" on public.videos for insert to authenticated with check (is_lead());
create policy "lead edits videos" on public.videos for update to authenticated
  using (is_lead()) with check (is_lead());
create policy "lead deletes videos" on public.videos for delete to authenticated using (is_lead());

create policy "team reads submissions" on public.submissions for select to authenticated using (is_member());
create policy "team reads comments" on public.feedback_comments for select to authenticated using (is_member());
create policy "team reads history" on public.video_events for select to authenticated using (is_member());

-- Column-level limits: status and workflow fields can only change through the
-- transition functions above.
revoke insert, update on public.videos from anon, authenticated;
grant insert (title, market, pillar_id, episode_number, brief, reference_link, target_post_date,
              shoot_day_id, editor_id)
  on public.videos to authenticated;
grant update (title, market, pillar_id, episode_number, brief, reference_link, target_post_date,
              shoot_day_id, editor_id)
  on public.videos to authenticated;

revoke update on public.profiles from anon, authenticated;
grant update (full_name, timezone, whatsapp_number) on public.profiles to authenticated;

revoke insert, update, delete on public.submissions, public.feedback_comments, public.video_events
  from anon, authenticated;

revoke execute on function public.lock_video(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.mark_shot(uuid) from public, anon;
revoke execute on function public.submit_for_review(uuid, text) from public, anon;
revoke execute on function public.approve_video(uuid) from public, anon;
revoke execute on function public.request_changes(uuid, jsonb) from public, anon;
revoke execute on function public.mark_posted(uuid, text) from public, anon;
grant execute on function public.mark_shot(uuid) to authenticated;
grant execute on function public.submit_for_review(uuid, text) to authenticated;
grant execute on function public.approve_video(uuid) to authenticated;
grant execute on function public.request_changes(uuid, jsonb) to authenticated;
grant execute on function public.mark_posted(uuid, text) to authenticated;

-- ==== seed.sql ====
-- Starter data. Pillars, templates and studios are placeholders: rename them freely.

insert into public.content_pillars (name, sort_order) values
  ('Training tips', 1),
  ('Member stories', 2),
  ('Coach spotlight', 3),
  ('Studio life', 4),
  ('Offers and events', 5)
on conflict (name) do nothing;

insert into public.brief_templates (name, pillar_id, brief, sort_order)
select t.name, p.id, t.brief, t.sort_order
from (values
  ('Coach tip', 'Training tips', 1,
   E'Hook (first 2s): one common mistake, shown.\nCoach explains the fix in one sentence.\nDemo: wrong way, then right way, side by side.\nEnd card: "Train with us at Tribuo".\nLength: 20 to 30s, vertical.'),
  ('Member transformation', 'Member stories', 2,
   E'Hook: member''s result in one line on screen.\nShort interview: why they joined, what changed.\nB-roll: member training with their coach.\nEnd card: book a trial session.\nLength: 30 to 45s, vertical.'),
  ('Studio promo', 'Offers and events', 3,
   E'Hook: the offer in one line.\nWide shots of the studio, small-group training in action.\nCoach to camera: who it is for.\nEnd card: offer details and how to book.\nLength: 15 to 20s, vertical.')
) as t(name, pillar, sort_order, brief)
join public.content_pillars p on p.name = t.pillar
on conflict (name) do nothing;

insert into public.studios (name, market) values
  ('Kuala Lumpur studio', 'MY'),
  ('Phnom Penh studio', 'KH')
on conflict (name, market) do nothing;

-- Team. Replace the emails before running, or add people later in the Team page.
-- insert into public.team_invites (email, full_name, role, market) values
--   ('celine@example.com', 'Celine', 'lead', null),
--   ('videographer@example.com', 'Videographer', 'videographer', null),
--   ('editor@example.com', 'Editor', 'editor', null);

-- ==== migrations/0002_open_team.sql ====
-- Replace email sign-in with "pick your name and colour".
--
-- Nobody signs in with Supabase Auth any more. The Next.js server talks to the
-- database with its secret key and remembers who you are in a cookie. Every
-- change goes through a function that takes the acting person (p_actor), checks
-- their role, and records them in the history.
--
-- The public (anon) key can no longer read or write anything.

-- ---------------------------------------------------------------------------
-- 1. Clear out email sign-in
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

drop function if exists public.mark_shot(uuid);
drop function if exists public.submit_for_review(uuid, text);
drop function if exists public.approve_video(uuid);
drop function if exists public.request_changes(uuid, jsonb);
drop function if exists public.mark_posted(uuid, text);
drop function if exists public.lock_video(uuid);
drop function if exists public.my_role();
drop function if exists public.is_member();
drop function if exists public.is_lead();

drop table if exists public.team_invites;

-- People are no longer tied to a login.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column email drop not null;

-- ---------------------------------------------------------------------------
-- 2. Who is acting
-- ---------------------------------------------------------------------------
create function public.current_actor() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor', true), '')::uuid
$$;

-- Checks the person is on the team and tags the rest of the transaction with
-- them, so triggers can record who did what.
create function public.act_as(p_actor uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p profiles;
begin
  select * into p from profiles where id = p_actor and active;
  if not found then
    raise exception 'not_allowed: choose who you are again';
  end if;
  perform set_config('app.actor', p.id::text, true);
  return p;
end $$;

create function public.get_video_locked(p_video_id uuid) returns public.videos
language plpgsql security definer set search_path = public as $$
declare
  v videos;
begin
  select * into v from videos where id = p_video_id for update;
  if not found then
    raise exception 'not_found: video not found';
  end if;
  return v;
end $$;

-- Triggers now read the actor from the transaction instead of auth.uid().
create or replace function public.videos_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  sd shoot_days;
begin
  select * into s from settings where id;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.created_by := coalesce(current_actor(), new.created_by);
    new.shot_at := null;
    new.latest_drive_link := null;
    new.posted_link := null;
  end if;

  if new.status in ('draft', 'to_shoot') then
    new.status := case when coalesce(btrim(new.brief), '') = '' then 'draft' else 'to_shoot' end;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.shoot_day_id is not null then
    select * into sd from shoot_days where id = new.shoot_day_id;
  end if;

  if new.status in ('to_edit', 'changes_requested') and new.editor_id is null then
    new.editor_id := default_member('editor', new.market);
  end if;

  new.assignee_id := case new.status
    when 'draft'             then default_member('lead', new.market)
    when 'to_shoot'          then coalesce(sd.videographer_id, default_member('videographer', new.market))
    when 'to_edit'           then new.editor_id
    when 'changes_requested' then new.editor_id
    when 'in_review'         then default_member('lead', new.market)
    when 'approved'          then default_member('lead', new.market)
    else null
  end;

  new.due_on := case new.status
    when 'to_shoot'          then sd.shoot_date
    when 'to_edit'           then (new.shot_at at time zone s.team_timezone)::date + s.edit_due_days
    when 'in_review'         then (new.status_changed_at at time zone s.team_timezone)::date + s.approval_due_days
    when 'changes_requested' then (new.status_changed_at at time zone s.team_timezone)::date + s.revision_due_days
    when 'approved'          then new.target_post_date
    else null
  end;

  new.updated_at := now();
  return new;
end $$;

create or replace function public.videos_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into video_events (video_id, actor_id, kind, to_status)
    values (new.id, current_actor(), 'created', new.status);
  elsif new.status is distinct from old.status then
    insert into video_events (video_id, actor_id, kind, from_status, to_status)
    values (new.id, current_actor(), 'status_changed', old.status, new.status);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Joining the team: a name and a colour (the colour is the role)
-- ---------------------------------------------------------------------------
create function public.join_team(p_name text, p_role public.user_role) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  existing uuid;
  new_id uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: add your name';
  end if;
  if length(p_name) > 60 then
    raise exception 'bad_name: that name is too long';
  end if;

  -- Same name and colour on a new phone: you're already on the team.
  select id into existing from profiles
  where active and role = p_role and lower(full_name) = lower(p_name) limit 1;
  if found then
    return existing;
  end if;

  if p_role = 'lead' and exists (select 1 from profiles where role = 'lead' and active) then
    raise exception 'role_taken: Head of Marketing is already taken. Tap your name in the list instead.';
  end if;

  insert into profiles (full_name, role) values (p_name, p_role) returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Everything else, as a named person
-- ---------------------------------------------------------------------------
create function public.save_video(
  p_actor uuid, p_id uuid, p_title text, p_market public.market, p_pillar_id uuid,
  p_episode_number int, p_brief text, p_reference_link text, p_target_post_date date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  vid uuid;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can write briefs';
  end if;

  if p_id is null then
    insert into videos (title, market, pillar_id, episode_number, brief, reference_link, target_post_date)
    values (p_title, p_market, p_pillar_id, p_episode_number, p_brief, p_reference_link, p_target_post_date)
    returning id into vid;
  else
    update videos
    set title = p_title, market = p_market, pillar_id = p_pillar_id, episode_number = p_episode_number,
        brief = p_brief, reference_link = p_reference_link, target_post_date = p_target_post_date
    where id = p_id
    returning id into vid;
    if vid is null then
      raise exception 'not_found: video not found';
    end if;
  end if;
  return vid;
end $$;

create function public.delete_video(p_actor uuid, p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can delete videos';
  end if;
  delete from videos where id = p_video_id;
end $$;

-- Videographer: "Shot"
create function public.mark_shot(p_actor uuid, p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
begin
  if a.role not in ('videographer', 'lead') then
    raise exception 'not_allowed: only the videographer can mark a video as shot';
  end if;
  if v.status <> 'to_shoot' then
    raise exception 'wrong_stage: this video is not waiting to be shot';
  end if;
  update videos set status = 'to_edit', shot_at = now() where id = p_video_id;
end $$;

-- Editor: paste Drive link + "Ready for review"
create function public.submit_for_review(p_actor uuid, p_video_id uuid, p_drive_link text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
  next_round int;
begin
  if a.role not in ('editor', 'lead') then
    raise exception 'not_allowed: only the editor can submit for review';
  end if;
  if v.status not in ('to_edit', 'changes_requested') then
    raise exception 'wrong_stage: this video is not being edited';
  end if;
  p_drive_link := btrim(coalesce(p_drive_link, ''));
  if p_drive_link !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'bad_link: paste a Google Drive link';
  end if;

  select coalesce(max(round), 0) + 1 into next_round from submissions where video_id = p_video_id;
  insert into submissions (video_id, round, drive_link, submitted_by)
  values (p_video_id, next_round, p_drive_link, a.id);

  update videos
  set status = 'in_review',
      latest_drive_link = p_drive_link,
      editor_id = coalesce(editor_id, a.id)
  where id = p_video_id;

  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, a.id, 'submitted',
          jsonb_build_object('round', next_round, 'drive_link', p_drive_link));
end $$;

-- Lead: "Approve"
create function public.approve_video(p_actor uuid, p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can approve';
  end if;
  if v.status <> 'in_review' then
    raise exception 'wrong_stage: this video is not waiting for approval';
  end if;
  update videos set status = 'approved' where id = p_video_id;
end $$;

-- Lead: "Request changes", one row per comment line
-- p_comments: [{"timecode": "0:12", "body": "..."}, ...]
create function public.request_changes(p_actor uuid, p_video_id uuid, p_comments jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
  latest_sub uuid;
  c jsonb;
  n int := 0;
  tc text;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can request changes';
  end if;
  if v.status <> 'in_review' then
    raise exception 'wrong_stage: this video is not waiting for approval';
  end if;

  select id into latest_sub from submissions
  where video_id = p_video_id order by round desc limit 1;

  for c in select * from jsonb_array_elements(coalesce(p_comments, '[]'::jsonb)) loop
    if coalesce(btrim(c ->> 'body'), '') <> '' then
      tc := nullif(btrim(coalesce(c ->> 'timecode', '')), '');
      if tc is not null and tc !~ '^[0-9]{1,2}:[0-5][0-9]$' then
        raise exception 'bad_timecode: use m:ss, for example 0:12';
      end if;
      insert into feedback_comments (video_id, submission_id, timecode, body, position, created_by)
      values (p_video_id, latest_sub, tc, btrim(c ->> 'body'), n, a.id);
      n := n + 1;
    end if;
  end loop;

  if n = 0 then
    raise exception 'no_comments: add at least one comment';
  end if;

  update videos set status = 'changes_requested' where id = p_video_id;

  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, a.id, 'changes_requested', jsonb_build_object('comments', n));
end $$;

-- Lead: "Posted"
create function public.mark_posted(p_actor uuid, p_video_id uuid, p_posted_link text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can mark a video as posted';
  end if;
  if v.status <> 'approved' then
    raise exception 'wrong_stage: this video has not been approved';
  end if;
  update videos
  set status = 'posted', posted_link = nullif(btrim(coalesce(p_posted_link, '')), '')
  where id = p_video_id;
end $$;

create function public.save_settings(p_actor uuid, p_edit int, p_approval int, p_revision int) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can change settings';
  end if;
  update settings
  set edit_due_days = p_edit, approval_due_days = p_approval, revision_due_days = p_revision
  where id;
end $$;

-- Lead: set a person's market (null = both) or remove them from the team
create function public.update_person(
  p_actor uuid, p_person uuid, p_market public.market, p_active boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can change the team';
  end if;
  if p_person = a.id and not p_active then
    raise exception 'not_allowed: you can''t remove yourself';
  end if;
  update profiles set market = p_market, active = p_active where id = p_person;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Lock the public door
-- ---------------------------------------------------------------------------
-- Row security stays on with no policies, so the public (anon) key sees nothing.
-- Only the server's secret key (service_role) can reach the data.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Keep it that way for anything added later.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ==== migrations/0003_shoot_days_and_feedback.sql ====
-- Phases 2 to 5: Shoot Days, shot list guardrail, feedback checkboxes.
-- Run after 0001 and 0002. Safe to run once.

-- ---------------------------------------------------------------------------
-- 1. Skipped shots
-- ---------------------------------------------------------------------------
alter table public.videos add column if not exists skip_reason text;
alter table public.videos add column if not exists skipped_at timestamptz;

-- A planned video that is not on a Shoot Day sits on the Head of Marketing's
-- list as "Unscheduled". Once it has a Shoot Day it goes to the videographer.
create or replace function public.videos_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  sd shoot_days;
begin
  select * into s from settings where id;

  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.created_by := coalesce(current_actor(), new.created_by);
    new.shot_at := null;
    new.latest_drive_link := null;
    new.posted_link := null;
  end if;

  if new.status in ('draft', 'to_shoot') then
    new.status := case when coalesce(btrim(new.brief), '') = '' then 'draft' else 'to_shoot' end;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.shoot_day_id is not null then
    select * into sd from shoot_days where id = new.shoot_day_id;
  end if;

  if new.status in ('to_edit', 'changes_requested') and new.editor_id is null then
    new.editor_id := default_member('editor', new.market);
  end if;

  new.assignee_id := case new.status
    when 'draft'             then default_member('lead', new.market)
    when 'to_shoot'          then case
                                    when new.shoot_day_id is null then default_member('lead', new.market)
                                    else coalesce(sd.videographer_id, default_member('videographer', new.market))
                                  end
    when 'to_edit'           then new.editor_id
    when 'changes_requested' then new.editor_id
    when 'in_review'         then default_member('lead', new.market)
    when 'approved'          then default_member('lead', new.market)
    else null
  end;

  new.due_on := case new.status
    when 'to_shoot'          then sd.shoot_date
    when 'to_edit'           then (new.shot_at at time zone s.team_timezone)::date + s.edit_due_days
    when 'in_review'         then (new.status_changed_at at time zone s.team_timezone)::date + s.approval_due_days
    when 'changes_requested' then (new.status_changed_at at time zone s.team_timezone)::date + s.revision_due_days
    when 'approved'          then new.target_post_date
    else null
  end;

  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Shoot Days
-- ---------------------------------------------------------------------------
create function public.create_shoot_day(
  p_actor uuid, p_date date, p_market public.market, p_studio uuid, p_videographer uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  new_id uuid;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can create Shoot Days';
  end if;
  if p_date is null then
    raise exception 'bad_date: pick a date';
  end if;
  insert into shoot_days (shoot_date, market, studio_id, videographer_id)
  values (p_date, p_market, p_studio, coalesce(p_videographer, default_member('videographer', p_market)))
  returning id into new_id;
  return new_id;
end $$;

-- Put a planned video on a Shoot Day (or move it).
create function public.attach_video(p_actor uuid, p_video_id uuid, p_day_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
  d shoot_days;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can plan Shoot Days';
  end if;
  select * into d from shoot_days where id = p_day_id;
  if not found then
    raise exception 'not_found: Shoot Day not found';
  end if;
  if d.closed_at is not null then
    raise exception 'closed: that Shoot Day is already closed';
  end if;
  if v.status <> 'to_shoot' then
    raise exception 'wrong_stage: write the brief first, then plan the shoot';
  end if;
  if v.market <> d.market then
    raise exception 'wrong_market: this video is for a different market than the Shoot Day';
  end if;
  update videos set shoot_day_id = p_day_id, skip_reason = null, skipped_at = null where id = p_video_id;
end $$;

-- Take a video off a Shoot Day; it goes back to Unscheduled.
create function public.detach_video(p_actor uuid, p_video_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can plan Shoot Days';
  end if;
  if v.status <> 'to_shoot' then
    raise exception 'wrong_stage: this video has already been shot';
  end if;
  update videos set shoot_day_id = null where id = p_video_id;
end $$;

-- Videographer: "Skipped" with a preset reason. The video drops back to Unscheduled.
create function public.skip_shot(p_actor uuid, p_video_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
begin
  if a.role not in ('videographer', 'lead') then
    raise exception 'not_allowed: only the videographer can skip a shot';
  end if;
  if v.status <> 'to_shoot' or v.shoot_day_id is null then
    raise exception 'wrong_stage: this video is not on a Shoot Day';
  end if;
  if p_reason not in ('Talent no-show', 'Ran out of time', 'Location unavailable', 'Will reshoot') then
    raise exception 'bad_reason: pick one of the reasons';
  end if;
  update videos set shoot_day_id = null, skip_reason = p_reason, skipped_at = now() where id = p_video_id;
  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, a.id, 'skipped', jsonb_build_object('reason', p_reason, 'shoot_day', v.shoot_day_id));
end $$;

-- Videographer: close the Shoot Day. Every shot must be Shot or Skipped first.
create function public.close_shoot_day(p_actor uuid, p_day_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  d shoot_days;
  waiting int;
begin
  if a.role not in ('videographer', 'lead') then
    raise exception 'not_allowed: only the videographer can close a Shoot Day';
  end if;
  select * into d from shoot_days where id = p_day_id for update;
  if not found then
    raise exception 'not_found: Shoot Day not found';
  end if;
  if d.closed_at is not null then
    return;
  end if;
  select count(*) into waiting from videos where shoot_day_id = p_day_id and status = 'to_shoot';
  if waiting > 0 then
    raise exception 'not_finished: tap Shot or Skipped on every item first (% left)', waiting;
  end if;
  update shoot_days set closed_at = now(), closed_by = a.id where id = p_day_id;
end $$;

-- Videographer: paste the raw footage folder link
create function public.save_footage_link(p_actor uuid, p_day_id uuid, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role not in ('videographer', 'lead') then
    raise exception 'not_allowed: only the videographer can add the footage link';
  end if;
  p_link := nullif(btrim(coalesce(p_link, '')), '');
  if p_link is not null and p_link !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'bad_link: paste a Google Drive link';
  end if;
  update shoot_days set footage_link = p_link where id = p_day_id;
end $$;

create function public.add_studio(p_actor uuid, p_name text, p_market public.market) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can add studios';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: add the studio name';
  end if;
  insert into studios (name, market) values (p_name, p_market) on conflict (name, market) do update set active = true;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Feedback checkboxes
-- ---------------------------------------------------------------------------
create function public.resolve_comment(p_actor uuid, p_comment_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role not in ('editor', 'lead') then
    raise exception 'not_allowed: only the editor can tick comments off';
  end if;
  update feedback_comments
  set resolved_at = case when p_done then now() else null end,
      resolved_by = case when p_done then a.id else null end,
      needs_clarification = case when p_done then false else needs_clarification end
  where id = p_comment_id;
end $$;

-- Editor: "Need clarification" chip. Shows up for the Head of Marketing.
create function public.flag_comment(p_actor uuid, p_comment_id uuid, p_flag boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role not in ('editor', 'lead') then
    raise exception 'not_allowed: only the editor can ask for clarification';
  end if;
  update feedback_comments set needs_clarification = p_flag where id = p_comment_id and resolved_at is null;
end $$;

-- The editor cannot resubmit until every comment is ticked.
create or replace function public.submit_for_review(p_actor uuid, p_video_id uuid, p_drive_link text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  v videos := get_video_locked(p_video_id);
  next_round int;
  open_comments int;
begin
  if a.role not in ('editor', 'lead') then
    raise exception 'not_allowed: only the editor can submit for review';
  end if;
  if v.status not in ('to_edit', 'changes_requested') then
    raise exception 'wrong_stage: this video is not being edited';
  end if;
  select count(*) into open_comments from feedback_comments where video_id = p_video_id and resolved_at is null;
  if open_comments > 0 then
    raise exception 'unresolved: tick off every comment first (% left)', open_comments;
  end if;
  p_drive_link := btrim(coalesce(p_drive_link, ''));
  if p_drive_link !~* '^https://(drive|docs)\.google\.com/' then
    raise exception 'bad_link: paste a Google Drive link';
  end if;

  select coalesce(max(round), 0) + 1 into next_round from submissions where video_id = p_video_id;
  insert into submissions (video_id, round, drive_link, submitted_by)
  values (p_video_id, next_round, p_drive_link, a.id);

  update videos
  set status = 'in_review',
      latest_drive_link = p_drive_link,
      editor_id = coalesce(editor_id, a.id)
  where id = p_video_id;

  insert into video_events (video_id, actor_id, kind, payload)
  values (p_video_id, a.id, 'submitted',
          jsonb_build_object('round', next_round, 'drive_link', p_drive_link));
end $$;

-- ---------------------------------------------------------------------------
-- 4. Lock the public door again (new functions are open to PUBLIC by default)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ==== migrations/0004_no_briefs.sql ====
-- No briefs: direction lives in Google Slides. A new video goes straight to
-- "To shoot" and needs a Shoot Day. The Slides link is optional.
-- Run after 0001, 0002 and 0003.

create or replace function public.videos_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s settings;
  sd shoot_days;
begin
  select * into s from settings where id;

  if tg_op = 'INSERT' then
    new.status := 'to_shoot';
    new.created_by := coalesce(current_actor(), new.created_by);
    new.shot_at := null;
    new.latest_drive_link := null;
    new.posted_link := null;
  end if;

  -- Old "brief to write" videos are simply "to shoot" now.
  if new.status = 'draft' then
    new.status := 'to_shoot';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.shoot_day_id is not null then
    select * into sd from shoot_days where id = new.shoot_day_id;
  end if;

  if new.status in ('to_edit', 'changes_requested') and new.editor_id is null then
    new.editor_id := default_member('editor', new.market);
  end if;

  new.assignee_id := case new.status
    when 'to_shoot'          then case
                                    when new.shoot_day_id is null then default_member('lead', new.market)
                                    else coalesce(sd.videographer_id, default_member('videographer', new.market))
                                  end
    when 'to_edit'           then new.editor_id
    when 'changes_requested' then new.editor_id
    when 'in_review'         then default_member('lead', new.market)
    when 'approved'          then default_member('lead', new.market)
    else null
  end;

  new.due_on := case new.status
    when 'to_shoot'          then sd.shoot_date
    when 'to_edit'           then (new.shot_at at time zone s.team_timezone)::date + s.edit_due_days
    when 'in_review'         then (new.status_changed_at at time zone s.team_timezone)::date + s.approval_due_days
    when 'changes_requested' then (new.status_changed_at at time zone s.team_timezone)::date + s.revision_due_days
    when 'approved'          then new.target_post_date
    else null
  end;

  new.updated_at := now();
  return new;
end $$;

-- Videos that were waiting for a brief become "to shoot" (goes through the trigger above).
update public.videos set updated_at = now() where status = 'draft';

-- Lock the public door again, as in the other migrations.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ==== migrations/0005_idea_bank.sql ====
-- Idea Bank. Same database as the video board, its own tables (all start with idea_).
-- People join with a name and a department (no sign-in). Only the Head of Marketing
-- (the board's "lead") can change statuses, departments and see everyone's entries.
-- Run after 0001 to 0004.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.idea_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  sort_order int not null default 0,
  active boolean not null default true
);

insert into public.idea_departments (name, sort_order) values
  ('Marketing', 1), ('Coaching', 2), ('Studio team', 3),
  ('Sales and memberships', 4), ('Operations', 5), ('Other', 6)
on conflict (name) do nothing;

create table public.idea_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and length(name) <= 60),
  department_id uuid references public.idea_departments (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.idea_submissions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.idea_people (id) on delete cascade,
  kind text not null check (kind in ('idea', 'feedback')),
  area text not null check (area in ('Content', 'Social', 'Campaigns', 'Studios', 'Team')),
  title text not null check (btrim(title) <> '' and length(title) <= 140),
  details text check (length(details) <= 4000),
  status text not null default 'new' check (status in ('new', 'shortlisted', 'used', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idea_submissions_person_idx on public.idea_submissions (person_id, created_at desc);

create table public.idea_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.idea_submissions (id) on delete cascade,
  path text not null,
  name text not null,
  mime text not null,
  size int not null check (size >= 0 and size <= 5242880),
  created_at timestamptz not null default now()
);
create index idea_files_submission_idx on public.idea_files (submission_id);

alter table public.idea_departments enable row level security;
alter table public.idea_people enable row level security;
alter table public.idea_submissions enable row level security;
alter table public.idea_files enable row level security;

-- Private bucket for attachments: one folder per person, 5 MB per file.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'idea-attachments', 'idea-attachments', false, 5242880,
      array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]
    )
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create function public.idea_join(p_name text, p_department uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  existing uuid;
  new_id uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: add your name';
  end if;
  if length(p_name) > 60 then
    raise exception 'bad_name: that name is too long';
  end if;
  if not exists (select 1 from idea_departments where id = p_department and active) then
    raise exception 'bad_department: pick your department';
  end if;

  -- Same name and department on a new phone: it's the same person.
  select id into existing from idea_people
  where lower(name) = lower(p_name) and department_id = p_department limit 1;
  if found then
    return existing;
  end if;

  insert into idea_people (name, department_id) values (p_name, p_department) returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------------
-- Entries
-- ---------------------------------------------------------------------------
-- p_files: [{"path": "<person id>/abc-photo.jpg", "name": "photo.jpg", "mime": "image/jpeg", "size": 12345}]
create function public.idea_submit(
  p_person uuid, p_kind text, p_area text, p_title text, p_details text, p_files jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sub_id uuid;
  f jsonb;
  n int := 0;
begin
  if not exists (select 1 from idea_people where id = p_person) then
    raise exception 'not_allowed: choose who you are again';
  end if;
  p_title := btrim(coalesce(p_title, ''));
  if p_title = '' then
    raise exception 'bad_title: add a few words to say what it is';
  end if;
  if p_kind not in ('idea', 'feedback') then
    raise exception 'bad_kind: pick Idea or Feedback';
  end if;
  if p_area not in ('Content', 'Social', 'Campaigns', 'Studios', 'Team') then
    raise exception 'bad_area: pick an area';
  end if;
  p_files := coalesce(p_files, '[]'::jsonb);
  if jsonb_array_length(p_files) > 3 then
    raise exception 'too_many_files: you can add up to 3 files';
  end if;

  insert into idea_submissions (person_id, kind, area, title, details)
  values (p_person, p_kind, p_area, p_title, nullif(btrim(coalesce(p_details, '')), ''))
  returning id into sub_id;

  for f in select * from jsonb_array_elements(p_files) loop
    if (f ->> 'path') not like p_person::text || '/%' then
      raise exception 'bad_file: that file is not in your folder';
    end if;
    if (f ->> 'size')::int > 5242880 then
      raise exception 'bad_file: files can be up to 5 MB';
    end if;
    insert into idea_files (submission_id, path, name, mime, size)
    values (sub_id, f ->> 'path', left(f ->> 'name', 200), f ->> 'mime', (f ->> 'size')::int);
    n := n + 1;
  end loop;
  return sub_id;
end $$;

-- Take back your own entry while it is still New. Returns the files to delete from storage.
create function public.idea_withdraw(p_person uuid, p_id uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  s idea_submissions;
  paths text[];
begin
  select * into s from idea_submissions where id = p_id and person_id = p_person;
  if not found then
    raise exception 'not_found: that entry isn''t yours or is already gone';
  end if;
  if s.status <> 'new' then
    raise exception 'locked: it has already been picked up, so it can''t be removed';
  end if;
  select coalesce(array_agg(path), '{}') into paths from idea_files where submission_id = p_id;
  delete from idea_submissions where id = p_id;
  return paths;
end $$;

-- ---------------------------------------------------------------------------
-- Admin (the board's Head of Marketing only)
-- ---------------------------------------------------------------------------
create function public.idea_set_status(p_actor uuid, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can change statuses';
  end if;
  if p_status not in ('new', 'shortlisted', 'used', 'archived') then
    raise exception 'bad_status: pick New, Shortlisted, Used or Archived';
  end if;
  update idea_submissions set status = p_status, updated_at = now() where id = p_id;
end $$;

create function public.idea_set_department(p_actor uuid, p_person uuid, p_department uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can change departments';
  end if;
  update idea_people set department_id = p_department where id = p_person;
end $$;

create function public.idea_dept_add(p_actor uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can edit departments';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: add the department name';
  end if;
  insert into idea_departments (name, sort_order)
  values (p_name, (select coalesce(max(sort_order), 0) + 1 from idea_departments))
  on conflict (name) do update set active = true;
end $$;

create function public.idea_dept_rename(p_actor uuid, p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can edit departments';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: add the department name';
  end if;
  if exists (select 1 from idea_departments where lower(name) = lower(p_name) and id <> p_id) then
    raise exception 'bad_name: there is already a department with that name';
  end if;
  update idea_departments set name = p_name where id = p_id;
end $$;

-- Hides a department from the sign-up list. People already in it keep it.
create function public.idea_dept_remove(p_actor uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can edit departments';
  end if;
  if (select count(*) from idea_departments where active) <= 1 then
    raise exception 'last_one: keep at least one department';
  end if;
  update idea_departments set active = false where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- Lock the public door (same as the other migrations)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ==== migrations/0006_todos.sql ====
-- To-do board: sections with to-dos under each, Basecamp style.
-- Anyone on the board team can add, tick, edit, delete and drag to-dos.
-- Only the Head of Marketing can add, rename or delete sections.
-- Run after 0001 to 0005. Safe to run once.

create table public.todo_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and length(name) <= 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index todo_sections_name_idx on public.todo_sections (lower(name));

insert into public.todo_sections (name, sort_order) values
  ('Tribuo Marketing', 1), ('Videography', 2), ('Content Strategy', 3);

create table public.todo_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.todo_sections (id) on delete cascade,
  title text not null check (btrim(title) <> '' and length(title) <= 200),
  position double precision not null default 0,
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  source_link text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index todo_items_section_idx on public.todo_items (section_id, done, position);

alter table public.todo_sections enable row level security;
alter table public.todo_items enable row level security;

-- Two titles are "the same" if they match ignoring case, spacing and punctuation.
create function public.todo_key(t text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '[[:space:][:punct:]]+', ' ', 'g')))
$$;

-- ---------------------------------------------------------------------------
-- Sections (Head of Marketing)
-- ---------------------------------------------------------------------------
create function public.todo_add_section(p_actor uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  new_id uuid;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can add sections';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: give the section a name';
  end if;
  if length(p_name) > 60 then
    raise exception 'bad_name: that name is too long';
  end if;
  if exists (select 1 from todo_sections where lower(name) = lower(p_name)) then
    raise exception 'bad_name: there is already a section with that name';
  end if;
  insert into todo_sections (name, sort_order)
  values (p_name, (select coalesce(max(sort_order), 0) + 1 from todo_sections))
  returning id into new_id;
  return new_id;
end $$;

create function public.todo_rename_section(p_actor uuid, p_id uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can rename sections';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' or length(p_name) > 60 then
    raise exception 'bad_name: give the section a name (up to 60 letters)';
  end if;
  if exists (select 1 from todo_sections where lower(name) = lower(p_name) and id <> p_id) then
    raise exception 'bad_name: there is already a section with that name';
  end if;
  update todo_sections set name = p_name where id = p_id;
end $$;

create function public.todo_delete_section(p_actor uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can delete sections';
  end if;
  if (select count(*) from todo_sections) <= 1 then
    raise exception 'last_one: keep at least one section';
  end if;
  delete from todo_sections where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- To-dos (anyone on the team)
-- ---------------------------------------------------------------------------
-- Adds titles to the end of a section. Titles already in that section are skipped.
create function public.todo_add_items(p_actor uuid, p_section uuid, p_titles text[], p_link text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  t text;
  clean text;
  added int := 0;
  skipped int := 0;
  pos double precision;
begin
  if not exists (select 1 from todo_sections where id = p_section) then
    raise exception 'not_found: that section is gone, refresh the page';
  end if;
  p_link := nullif(btrim(coalesce(p_link, '')), '');
  if p_link is not null and p_link !~* '^https://' then
    raise exception 'bad_link: the link has to start with https://';
  end if;
  select coalesce(max(position), 0) into pos from todo_items where section_id = p_section;

  foreach t in array coalesce(p_titles, '{}') loop
    clean := left(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g'), 200);
    if clean = '' then
      continue;
    end if;
    if exists (select 1 from todo_items where section_id = p_section and todo_key(title) = todo_key(clean)) then
      skipped := skipped + 1;
      continue;
    end if;
    pos := pos + 1024;
    insert into todo_items (section_id, title, position, source_link, created_by)
    values (p_section, clean, pos, p_link, a.id);
    added := added + 1;
  end loop;
  return jsonb_build_object('added', added, 'skipped', skipped);
end $$;

create function public.todo_set_done(p_actor uuid, p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  update todo_items
  set done = p_done,
      done_at = case when p_done then now() else null end,
      done_by = case when p_done then a.id else null end,
      position = case when p_done then position else (select coalesce(max(position), 0) + 1024 from todo_items where section_id = (select section_id from todo_items where id = p_id) and not done) end
  where id = p_id;
  if not found then
    raise exception 'not_found: that to-do is gone, refresh the page';
  end if;
end $$;

create function public.todo_edit_item(p_actor uuid, p_id uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  p_title := left(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'), 200);
  if p_title = '' then
    raise exception 'bad_title: a to-do needs a title';
  end if;
  update todo_items set title = p_title where id = p_id;
  if not found then
    raise exception 'not_found: that to-do is gone, refresh the page';
  end if;
end $$;

create function public.todo_delete_item(p_actor uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  it todo_items;
begin
  select * into it from todo_items where id = p_id;
  if not found then
    return;
  end if;
  if a.role <> 'lead' and it.created_by is distinct from a.id then
    raise exception 'not_allowed: you can delete your own to-dos, and Celine can delete any';
  end if;
  delete from todo_items where id = p_id;
end $$;

-- Drag and drop: put a to-do in a section at a spot (0 = top) among that section's open to-dos.
create function public.todo_move_item(p_actor uuid, p_id uuid, p_section uuid, p_index int) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  ids uuid[];
  idx int;
begin
  if not exists (select 1 from todo_items where id = p_id) then
    raise exception 'not_found: that to-do is gone, refresh the page';
  end if;
  if not exists (select 1 from todo_sections where id = p_section) then
    raise exception 'not_found: that section is gone, refresh the page';
  end if;

  select coalesce(array_agg(id order by position, created_at), '{}') into ids
  from todo_items where section_id = p_section and not done and id <> p_id;

  idx := least(greatest(coalesce(p_index, 0), 0), coalesce(array_length(ids, 1), 0));
  ids := ids[1:idx] || p_id || ids[idx + 1:coalesce(array_length(ids, 1), 0)];

  update todo_items set section_id = p_section, done = false, done_at = null, done_by = null where id = p_id;
  update todo_items t set position = u.n * 1024
  from unnest(ids) with ordinality as u(id, n)
  where t.id = u.id;
end $$;

-- ---------------------------------------------------------------------------
-- Lock the public door (same as the other migrations)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tell the API the tables and functions changed
-- ==== migrations/0007_todos_basecamp.sql ====
-- To-do board, Basecamp style: lists get a description; to-dos get notes, an
-- assignee and a due date. Safe to run more than once. Run after 0006.

alter table public.todo_sections add column if not exists description text check (length(description) <= 300);

alter table public.todo_items add column if not exists notes text check (length(notes) <= 2000);
alter table public.todo_items add column if not exists assignee_id uuid references public.profiles (id) on delete set null;
alter table public.todo_items add column if not exists due_on date;

-- ---------------------------------------------------------------------------
-- Lists (Head of Marketing)
-- ---------------------------------------------------------------------------
drop function if exists public.todo_add_section(uuid, text);
create or replace function public.todo_add_section(p_actor uuid, p_name text, p_description text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  new_id uuid;
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can add lists';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' then
    raise exception 'bad_name: give the list a name';
  end if;
  if length(p_name) > 60 then
    raise exception 'bad_name: that name is too long';
  end if;
  if exists (select 1 from todo_sections where lower(name) = lower(p_name)) then
    raise exception 'bad_name: there is already a list with that name';
  end if;
  insert into todo_sections (name, description, sort_order)
  values (p_name, left(nullif(btrim(coalesce(p_description, '')), ''), 300),
          (select coalesce(max(sort_order), 0) + 1 from todo_sections))
  returning id into new_id;
  return new_id;
end $$;

drop function if exists public.todo_rename_section(uuid, uuid, text);
create or replace function public.todo_edit_section(p_actor uuid, p_id uuid, p_name text, p_description text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  if a.role <> 'lead' then
    raise exception 'not_allowed: only the Head of Marketing can edit lists';
  end if;
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' or length(p_name) > 60 then
    raise exception 'bad_name: give the list a name (up to 60 letters)';
  end if;
  if exists (select 1 from todo_sections where lower(name) = lower(p_name) and id <> p_id) then
    raise exception 'bad_name: there is already a list with that name';
  end if;
  update todo_sections
  set name = p_name, description = left(nullif(btrim(coalesce(p_description, '')), ''), 300)
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- To-dos (anyone on the team)
-- ---------------------------------------------------------------------------
create or replace function public.todo_check_assignee(p_assignee uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_assignee is not null and not exists (select 1 from profiles where id = p_assignee and active) then
    raise exception 'bad_assignee: pick someone from the team';
  end if;
end $$;

-- One to-do with the details Basecamp has: notes, who it is for, and when it is due.
create or replace function public.todo_add_item(
  p_actor uuid, p_section uuid, p_title text, p_notes text, p_assignee uuid, p_due date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
  new_id uuid;
begin
  if not exists (select 1 from todo_sections where id = p_section) then
    raise exception 'not_found: that list is gone, refresh the page';
  end if;
  p_title := left(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'), 200);
  if p_title = '' then
    raise exception 'bad_title: describe the to-do';
  end if;
  perform todo_check_assignee(p_assignee);
  insert into todo_items (section_id, title, notes, assignee_id, due_on, position, created_by)
  values (p_section, p_title, left(nullif(btrim(coalesce(p_notes, '')), ''), 2000), p_assignee, p_due,
          (select coalesce(max(position), 0) + 1024 from todo_items where section_id = p_section),
          a.id)
  returning id into new_id;
  return new_id;
end $$;

drop function if exists public.todo_edit_item(uuid, uuid, text);
create or replace function public.todo_edit_item(
  p_actor uuid, p_id uuid, p_title text, p_notes text, p_assignee uuid, p_due date
) returns void
language plpgsql security definer set search_path = public as $$
declare
  a profiles := act_as(p_actor);
begin
  p_title := left(regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g'), 200);
  if p_title = '' then
    raise exception 'bad_title: describe the to-do';
  end if;
  perform todo_check_assignee(p_assignee);
  update todo_items
  set title = p_title, notes = left(nullif(btrim(coalesce(p_notes, '')), ''), 2000),
      assignee_id = p_assignee, due_on = p_due
  where id = p_id;
  if not found then
    raise exception 'not_found: that to-do is gone, refresh the page';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Lock the public door (same as the other migrations)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ==== migrations/0008_admin_access.sql ====
-- Admin sign-in: the email addresses allowed into the admin side.
-- People prove their email with a one-time code, then this list decides if they get in.
-- Safe to run more than once. Run after 0007.

create table if not exists public.admin_emails (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ==== migrations/0009_idea_bank_public.sql ====
-- Idea Bank becomes a public form: no names, no departments, no "your submissions".
-- Anyone with the link can send an idea. Only the admin side reads them.
-- This removes the people and departments tables. Existing entries and files are kept
-- (they just stop saying who sent them). Safe to run more than once. Run after 0008.

drop function if exists public.idea_join(text, uuid);
drop function if exists public.idea_withdraw(uuid, uuid);
drop function if exists public.idea_set_department(uuid, uuid, uuid);
drop function if exists public.idea_dept_add(uuid, text);
drop function if exists public.idea_dept_rename(uuid, uuid, text);
drop function if exists public.idea_dept_remove(uuid, uuid);
drop function if exists public.idea_submit(uuid, text, text, text, text, jsonb);

alter table public.idea_submissions drop column if exists person_id;
drop table if exists public.idea_people cascade;
drop table if exists public.idea_departments cascade;

-- p_folder is a random id the website makes up for this entry's files.
-- p_files: [{"path": "<folder>/abc-photo.jpg", "name": "photo.jpg", "mime": "image/jpeg", "size": 12345}]
create or replace function public.idea_submit_public(
  p_folder uuid, p_kind text, p_area text, p_title text, p_details text, p_files jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sub_id uuid;
  f jsonb;
begin
  p_title := btrim(coalesce(p_title, ''));
  if p_title = '' then
    raise exception 'bad_title: add a few words to say what it is';
  end if;
  if length(p_title) > 140 then
    raise exception 'bad_title: keep it under 140 letters';
  end if;
  if p_kind not in ('idea', 'feedback') then
    raise exception 'bad_kind: pick Idea or Feedback';
  end if;
  if p_area not in ('Content', 'Social', 'Campaigns', 'Studios', 'Team') then
    raise exception 'bad_area: pick an area';
  end if;
  p_files := coalesce(p_files, '[]'::jsonb);
  if jsonb_array_length(p_files) > 3 then
    raise exception 'too_many_files: you can add up to 3 files';
  end if;

  insert into idea_submissions (kind, area, title, details)
  values (p_kind, p_area, p_title, left(nullif(btrim(coalesce(p_details, '')), ''), 4000))
  returning id into sub_id;

  for f in select * from jsonb_array_elements(p_files) loop
    if (f ->> 'path') not like p_folder::text || '/%' then
      raise exception 'bad_file: that file is not in the right folder';
    end if;
    if (f ->> 'size')::int > 5242880 then
      raise exception 'bad_file: files can be up to 5 MB';
    end if;
    insert into idea_files (submission_id, path, name, mime, size)
    values (sub_id, f ->> 'path', left(f ->> 'name', 200), f ->> 'mime', (f ->> 'size')::int);
  end loop;
  return sub_id;
end $$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

notify pgrst, 'reload schema';
