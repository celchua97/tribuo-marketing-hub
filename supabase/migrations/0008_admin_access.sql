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
