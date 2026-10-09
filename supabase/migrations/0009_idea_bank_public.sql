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
