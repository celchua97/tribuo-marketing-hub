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
