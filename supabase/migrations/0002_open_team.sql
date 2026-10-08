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
