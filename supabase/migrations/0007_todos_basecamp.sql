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
