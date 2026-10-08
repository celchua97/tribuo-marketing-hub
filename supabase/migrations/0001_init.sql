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
