-- To-do board: sections with to-dos under each, Basecamp style.
-- Anyone on the board team can add, tick, edit, delete and drag to-dos.
-- Only the Head of Marketing can add, rename or delete sections.
-- Run after 0001 to 0005. Safe to run more than once.

create table if not exists public.todo_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and length(name) <= 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists todo_sections_name_idx on public.todo_sections (lower(name));

insert into public.todo_sections (name, sort_order)
select v.name, v.n from (values ('Tribuo Marketing', 1), ('Videography', 2), ('Content Strategy', 3)) as v(name, n)
where not exists (select 1 from public.todo_sections);

create table if not exists public.todo_items (
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
create index if not exists todo_items_section_idx on public.todo_items (section_id, done, position);

alter table public.todo_sections enable row level security;
alter table public.todo_items enable row level security;

-- Two titles are "the same" if they match ignoring case, spacing and punctuation.
create or replace function public.todo_key(t text) returns text
language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '[[:space:][:punct:]]+', ' ', 'g')))
$$;

-- ---------------------------------------------------------------------------
-- Sections (Head of Marketing)
-- ---------------------------------------------------------------------------
create or replace function public.todo_add_section(p_actor uuid, p_name text) returns uuid
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

create or replace function public.todo_rename_section(p_actor uuid, p_id uuid, p_name text) returns void
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

create or replace function public.todo_delete_section(p_actor uuid, p_id uuid) returns void
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
create or replace function public.todo_add_items(p_actor uuid, p_section uuid, p_titles text[], p_link text)
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

create or replace function public.todo_set_done(p_actor uuid, p_id uuid, p_done boolean) returns void
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

create or replace function public.todo_edit_item(p_actor uuid, p_id uuid, p_title text) returns void
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

create or replace function public.todo_delete_item(p_actor uuid, p_id uuid) returns void
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
create or replace function public.todo_move_item(p_actor uuid, p_id uuid, p_section uuid, p_index int) returns void
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
