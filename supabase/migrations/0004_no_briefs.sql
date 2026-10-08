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
