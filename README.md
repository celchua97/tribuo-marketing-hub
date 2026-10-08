# Tribuo content board

A lean internal tool for the Tribuo content team: briefs, shoots, edits and approvals, with each person's to-do list as the home screen.

**Chain:** Brief (Celine) → Shoot (Videographer) → Edit (Editor) → Approve (Celine) → Posted

Built with Next.js, Supabase (Postgres and magic-link login) and Tailwind, and deployed to Vercel. Videos stay in Google Drive; the tool only stores links.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data model, login, roles, video cards, chain with automatic handover | Done |
| 2 | Personal to-do lists as the home screen (overdue, today, upcoming) | Next |
| 3 | Shoot Days, shot list guardrail, Unscheduled warnings | |
| 4 | Feedback checkboxes, approval aging | |
| 5 | WhatsApp nudge buttons, "All videos" list | |

## How it works

The rules live in the database, so the app can't get out of step with them:

- **Status only changes through buttons.** Each button calls one database function (`mark_shot`, `submit_for_review`, `approve_video`, `request_changes`, `mark_posted`), and that function checks who is tapping it and what stage the video is at.
- **Handover is automatic.** Whenever a video changes, a trigger works out whose list it's on (`assignee_id`) and when it's due (`due_on`).
- **History is automatic.** Every status change, submission and round of feedback is written to `video_events`, with the person and the time.
- **Sign-up is invite only.** Only emails added in Settings > Team (or in `team_invites`) can sign in.

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
| `team_invites` | Emails allowed to sign in, with their role |
| `settings` | Due-date defaults and the team timezone |
| `content_pillars` | Pillar dropdown options |
| `brief_templates` | Reusable briefs |
| `studios` | Studio list per market |
| `shoot_days` | Date, market, studio, videographer, footage link, closed time (UI in phase 3) |
| `videos` | Title, market, pillar, episode, brief, reference link, target post date, status, assignee, due date, Shoot Day, latest Drive link |
| `submissions` | Each "Ready for review" tap with its Drive link (version history) |
| `feedback_comments` | One row per comment line, with optional timestamp, resolved time and a "needs clarification" flag |
| `video_events` | Automatic history; also the event feed a WhatsApp or Telegram integration can read later |

To add a person later (for example, a Cambodia videographer), add them in Settings > Team and set their market to Cambodia. Cambodia videos then go to them automatically, and Malaysia videos keep going to whoever covers Malaysia.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com). The Singapore region is closest to both markets.
2. Open **SQL Editor**, then paste and run `supabase/migrations/0001_init.sql`, followed by `supabase/seed.sql`.
3. Add yourself and the team (replace the emails):
   ```sql
   insert into public.team_invites (email, full_name, role, market) values
     ('you@tribuo.com', 'Celine', 'lead', null),
     ('videographer@tribuo.com', 'Videographer name', 'videographer', null),
     ('editor@tribuo.com', 'Editor name', 'editor', null);
   ```
4. **Authentication > Sign In / Providers**: keep Email enabled and "Allow new users to sign up" **on**. The invite list is what blocks strangers.
5. **Authentication > URL Configuration**: set Site URL to your Vercel URL, and add `https://<your-vercel-url>/auth/confirm` and `http://localhost:3000/auth/confirm` under Redirect URLs.
6. **Authentication > Emails > Magic link**: replace the template body so links work when opened from a phone's mail app, and include the 6-digit code as a fallback:
   ```html
   <h2>Sign in to Tribuo content</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Tap here to sign in</a></p>
   <p>Or enter this code: <strong>{{ .Token }}</strong></p>
   ```
   Do the same for the **Confirm signup** template, which is used the first time each person signs in.
7. From **Project Settings > API**, copy the Project URL and the publishable key.

### 2. Vercel

1. Import this repository in Vercel.
2. Add the environment variables from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy, then put the deployed URL into Supabase step 5.

### Local development

```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

`npm run typecheck` and `npm run build` should both pass before you deploy.
