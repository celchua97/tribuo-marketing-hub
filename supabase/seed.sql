-- Starter data. Pillars, templates and studios are placeholders: rename them freely.

insert into public.content_pillars (name, sort_order) values
  ('Training tips', 1),
  ('Member stories', 2),
  ('Coach spotlight', 3),
  ('Studio life', 4),
  ('Offers and events', 5)
on conflict (name) do nothing;

insert into public.brief_templates (name, pillar_id, brief, sort_order)
select t.name, p.id, t.brief, t.sort_order
from (values
  ('Coach tip', 'Training tips', 1,
   E'Hook (first 2s): one common mistake, shown.\nCoach explains the fix in one sentence.\nDemo: wrong way, then right way, side by side.\nEnd card: "Train with us at Tribuo".\nLength: 20 to 30s, vertical.'),
  ('Member transformation', 'Member stories', 2,
   E'Hook: member''s result in one line on screen.\nShort interview: why they joined, what changed.\nB-roll: member training with their coach.\nEnd card: book a trial session.\nLength: 30 to 45s, vertical.'),
  ('Studio promo', 'Offers and events', 3,
   E'Hook: the offer in one line.\nWide shots of the studio, small-group training in action.\nCoach to camera: who it is for.\nEnd card: offer details and how to book.\nLength: 15 to 20s, vertical.')
) as t(name, pillar, sort_order, brief)
join public.content_pillars p on p.name = t.pillar
on conflict (name) do nothing;

insert into public.studios (name, market) values
  ('Kuala Lumpur studio', 'MY'),
  ('Phnom Penh studio', 'KH')
on conflict (name, market) do nothing;

-- Team. Replace the emails before running, or add people later in the Team page.
-- insert into public.team_invites (email, full_name, role, market) values
--   ('celine@example.com', 'Celine', 'lead', null),
--   ('videographer@example.com', 'Videographer', 'videographer', null),
--   ('editor@example.com', 'Editor', 'editor', null);
