-- Catch-up: runs 0007, 0008 and 0009 in one go. Safe to run more than once.
-- Use it when the site says it "could not find the function" or a table is missing.
-- Keeps your to-dos, lists and ideas. (0009 removes the Idea Bank names and departments.)

-- ==== 0007_todos_basecamp.sql ====
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

notify pgrst, 'reload schema';

-- ==== 0008_admin_access.sql ====
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

notify pgrst, 'reload schema';

-- ==== 0009_idea_bank_public.sql ====
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

