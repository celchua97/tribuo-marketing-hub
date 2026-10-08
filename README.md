# Tribuo content board

A lean internal tool for the Tribuo content team: briefs, shoots, edits and approvals, with each person's to-do list as the home screen.

**Chain:** Brief (Celine) → Shoot (Videographer) → Edit (Editor) → Approve (Celine) → Posted

Built with Next.js, Supabase (Postgres) and Tailwind, and deployed to Vercel. Videos stay in Google Drive; the tool only stores links.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data model, name-and-colour team picker, roles, video cards, chain with automatic handover | Done |
| 2 | Personal to-do lists as the home screen (overdue, today, upcoming) | Next |
| 3 | Shoot Days, shot list guardrail, Unscheduled warnings | |
| 4 | Feedback checkboxes, approval aging | |
| 5 | WhatsApp nudge buttons, "All videos" list | |

## How it works

The rules live in the database, so the app can't get out of step with them:

- **Status only changes through buttons.** Each button calls one database function (`mark_shot`, `submit_for_review`, `approve_video`, `request_changes`, `mark_posted`), and that function checks who is tapping it and what stage the video is at.
- **Handover is automatic.** Whenever a video changes, a trigger works out whose list it's on (`assignee_id`) and when it's due (`due_on`).
- **History is automatic.** Every status change, submission and round of feedback is written to `video_events`, with the person and the time.
- **No sign-in.** Open the link, type your name and tap your colour. The colour is your role: black is Head of Marketing, blue is Videographer, coral is Editor. Your phone remembers you. On a new device, tap your name on the list. Head of Marketing can only be claimed once.
- **The browser never touches the database.** The server uses a secret key and checks your role in the database function for every action. The public key is locked out completely.

> Because there are no passwords, anyone with the link can tap Celine's name and act as Head of Marketing. Keep the link inside the team. If that ever matters, a PIN on the Head of Marketing name is a small addition.

### Who has it, and when it's due

| Status | Shown as | On whose list | Due |
| --- | --- | --- | --- |
| `draft` | Brief to write | Celine | none |
| `to_shoot` | To shoot | Videographer (from the Shoot Day in phase 3) | Shoot Day date |
| `to_edit` | Editing | Editor | shoot date + 3 days |
| `in_review` | Awaiting approval | Celine | submitted + 1 day |
| `changes_requested` | Changes requested | Editor | requested + 2 days |
| `approved` | Approved, to post | Celine | target post date |
| `posted` | Posted | nobody | none |

Writing a brief moves a video from "Brief to write" to "To shoot" automatically. You can change the day counts in Settings, and in-flight videos are re-dated straight away.

### Data model

| Table | What it holds |
| --- | --- |
| `profiles` | Team members: name, role (`lead`, `videographer`, `editor`), optional market, timezone, WhatsApp number (for a later integration) |
| `settings` | Due-date defaults and the team timezone |
| `content_pillars` | Pillar dropdown options |
| `brief_templates` | Reusable briefs |
| `studios` | Studio list per market |
| `shoot_days` | Date, market, studio, videographer, footage link, closed time (UI in phase 3) |
| `videos` | Title, market, pillar, episode, brief, reference link, target post date, status, assignee, due date, Shoot Day, latest Drive link |
| `submissions` | Each "Ready for review" tap with its Drive link (version history) |
| `feedback_comments` | One row per comment line, with optional timestamp, resolved time and a "needs clarification" flag |
| `video_events` | Automatic history; also the event feed a WhatsApp or Telegram integration can read later |

To add a person later (for example, a Cambodia videographer), have them add themselves as a Videographer, then set their market to Cambodia in Settings > Team. Cambodia videos then go to them automatically, and Malaysia videos keep going to whoever covers Malaysia.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). The Singapore region is closest to both markets.
2. Open **SQL Editor**, then paste and run these files in order:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/seed.sql`
   3. `supabase/migrations/0002_open_team.sql`
3. From **Project Settings > API Keys**, copy the **Project URL** and the **Secret key** (it starts with `sb_secret_`). If you only see the older "anon" and "service_role" keys, copy `service_role`. Treat it like a password: it goes in Vercel only, never in the code.

### 2. Vercel

1. Import this repository in Vercel.
2. Add two environment variables (see `.env.example`): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy, open the link, and set up your own name first so you claim Head of Marketing.

### Local development

```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

`npm run typecheck` and `npm run build` should both pass before you deploy.

### Adding to the database later

New tables must not be readable with the public key. Migrations after `0002` should end with `revoke all on <table> from anon, authenticated;` (the default privileges set in `0002` already cover this in the Supabase SQL editor, but check).
