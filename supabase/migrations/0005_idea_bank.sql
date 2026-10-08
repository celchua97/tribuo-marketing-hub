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
