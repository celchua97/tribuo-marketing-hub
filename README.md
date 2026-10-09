# Tribuo content board

A lean internal tool for the Tribuo content team: briefs, shoots, edits and approvals, with each person's to-do list as the home screen.

**Chain:** Plan (Celine) → Shoot (Videographer) → Edit (Editor) → Approve (Celine) → Posted

Direction stays in Google Slides; each video just carries an optional link to it. The point of the board is accountability: everyone taps when their step is done, so Celine can see who to follow up with and whether anything was missed.

Built with Next.js, Supabase (Postgres) and Tailwind, and deployed to Vercel. Videos stay in Google Drive; the tool only stores links.

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Data model, name-and-colour team picker, roles, video cards, chain with automatic handover | Done |
| 2 | Personal to-do lists as the home screen (overdue, due today, upcoming) | Done |
| 3 | Shoot Days, shot list guardrail, Unscheduled warnings | Done |
| 4 | Feedback checkboxes, approval aging | Done |
| 5 | WhatsApp nudge buttons, "All videos" list | Done |
| + | Follow up section: who is overdue or quiet, with a nudge ready to copy | Done |

## The Hub overview

The home page (`/`) is a dashboard for whoever has picked a name: tiles for open, overdue and due-today to-dos and videos awaiting approval; **Needs attention** (overdue to-dos, to-dos nobody has, videos waiting or unscheduled, people who have gone quiet); progress bars for each to-do list; the content pipeline counts; open to-dos per person; and recent activity. Below that are links to To-dos, the Idea Bank and Admin.

## Admin sign in

The admin side (Admin pages, Board settings, adding lists and videos) needs two things: the Head of Marketing name, and a signed-in admin email. At `/login` you type your email, Supabase emails you a one-time code, and if the email is on the allowed list you are in for 30 days on that device. **Admin > Access** lets the owner add and remove allowed emails. The owner is `celine.chuayq@gmail.com` (set in `lib/admin-auth.ts`), plus anything in `ADMIN_EMAILS` or `OWNER_EMAILS` in Vercel. Other admins can use the admin side but cannot change who has access. Removing one locks that person out straight away.

Setup, once:

1. Run `supabase/migrations/0008_admin_access.sql`, then add your own email: `insert into admin_emails (email) values ('you@example.com');` (or set `ADMIN_EMAILS` in Vercel, comma separated, which always works and cannot be removed from the page).
2. In Supabase open **Authentication > Emails** (Email Templates) and edit both **Confirm sign up** and **Magic Link** so the body contains `Your code is {{ .Token }}`. The code is what people type in.
3. Supabase's built-in email sender is limited to a few emails an hour, which is plenty for admin sign-ins. For more, add your own SMTP provider under Authentication > Emails.

If email codes do not arrive, set `ADMIN_PASSCODE` in Vercel (12 or more characters). The sign-in page then shows "No email? Use the backup passcode". The email must still be on the admin list. Sign-in errors from Supabase are shown on the page, which says why an email did not send.

Everything else (the Hub, to-dos, the Idea Bank) stays open to anyone with the link and a name.

## The Hub

The site is one app with a fixed sidebar on laptops (Dashboard, To-dos, Idea Bank, and Admin for the Head of Marketing) and a tab bar along the bottom on phones. Nothing hides or slides. People can add it to their phone's home screen and it opens full screen like an app.

Pages: `/` Hub home, `/board` your list, `/shoot-days`, `/videos`, `/ideas`, `/admin`, `/settings`. The "tribuo." logo is `public/tribuo-logo.svg` (Tribuo blue).

## To-dos

`/todos` follows Basecamp's layout in Tribuo colours: a big "To-dos" title, a toolbar (**+ New list**, **Filter…**, and a list or grid view toggle that your browser remembers), then flat lists. Each list has a progress circle (empty, part-filled, or ticked when everything is done), a bold name and a grey description. Each to-do has a checkbox, its title, a notes icon, who it is for (initials and "First L."), and a due date (cream, yellow for today, salmon when overdue). Click **Add a to-do** to open the inline form: title, notes, Assign to, Due on. Click a title to edit it or delete it. Ticked to-dos fold into "N completed", which shows who ticked them. Drag to-dos with the handle to reorder, or into another list, with a mouse or a finger. The filter looks at titles, notes and names. Only the Head of Marketing can add, edit or delete lists. It starts with Tribuo Marketing, Videography and Content Strategy. The Slides import can send its titles here, into a list or a new one; titles already in the list are skipped.

## Adding videos from Google Slides

On **New video**, paste a Google Slides link (set to "Anyone with the link can view") or upload a PowerPoint file. The site reads each slide's title (the title box, or the biggest lettering if there isn't one), drops repeats and keeps the first, and shows them as a checklist. Tick the ones to add, fix any title, and tap Add. Titles already on that market's board are skipped. Each new video keeps the Slides link so everyone can open the script. The old content pillar and target post date fields are gone; adding a single video is still there, folded under the checklist.

## Idea Bank

A second tool on the same website, at `/ideas`. It has its own link you can share.

- **No sign-in.** People type their name and pick a department once. Their phone remembers them; "Switch" covers a new phone. The department list is editable in Admin.
- **Two tabs:** Submit, and Your submissions. People only ever see their own entries.
- **Submit:** Idea (yellow) or Feedback (salmon), an area, a few words, optional details, and up to 3 files (screenshots are shrunk in the browser; PDF, Word and PowerPoint up to 5 MB). Drag and drop, paste a screenshot, thumbnails, and a larger preview with a Download button.
- **Admin** (the gear button, Head of Marketing only): **Ideas** has summary counts, filters by type, area, department and status, a status picker on each item (New, Shortlisted, Used, Archived), and the Export card (Copy for Claude, Save CSV, Save JSON). **People** lists everyone who has joined, with a department dropdown each, and the editable department list. **Board** opens the video board settings.
- **Files** live in a private Supabase storage bucket, one folder per person, and are shown through short-lived links. Uploads go straight from the browser to storage.

## How it works

The rules live in the database, so the app can't get out of step with them:

- **Status only changes through buttons.** Each button calls one database function (`mark_shot`, `submit_for_review`, `approve_video`, `request_changes`, `mark_posted`), and that function checks who is tapping it and what stage the video is at.
- **Nothing planned goes unshot.** A video that isn't on a Shoot Day sits on Celine's list as Unscheduled. On the day, every item must be tapped Shot or Skipped (with a preset reason) before the day can be closed. Skipped items drop back to Unscheduled.
- **Comments are checkboxes.** The editor can't resubmit until every comment is ticked.
- **Follow up.** Celine's list shows anyone with overdue work, or with work on their plate and no update for two days, plus a ready-to-paste nudge for them.
- **Handover is automatic.** Whenever a video changes, a trigger works out whose list it's on (`assignee_id`) and when it's due (`due_on`).
- **History is automatic.** Every status change, submission and round of feedback is written to `video_events`, with the person and the time.
- **No sign-in.** Open the link, type your name and tap your colour. The colour is your role: black is Head of Marketing, blue is Videographer, coral is Editor. Your phone remembers you. On a new device, tap your name on the list. Head of Marketing can only be claimed once.
- **The browser never touches the database.** The server uses a secret key and checks your role in the database function for every action. The public key is locked out completely.

> Because there are no passwords, anyone with the link can tap Celine's name and act as Head of Marketing. Keep the link inside the team. If that ever matters, a PIN on the Head of Marketing name is a small addition.

### Who has it, and when it's due

| Status | Shown as | On whose list | Due |
| --- | --- | --- | --- |
| `to_shoot`, no Shoot Day | To shoot (Unscheduled) | Celine | none |
| `to_shoot`, on a Shoot Day | To shoot | Videographer | Shoot Day date |
| `to_edit` | Editing | Editor | shoot date + 3 days |
| `in_review` | Awaiting approval | Celine | submitted + 1 day |
| `changes_requested` | Changes requested | Editor | requested + 2 days |
| `approved` | Approved, to post | Celine | target post date |
| `posted` | Posted | nobody | none |

You can change the day counts in Settings, and in-flight videos are re-dated straight away.

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

**Quickest:** run `supabase/fresh-start.sql` once in the SQL Editor. It rebuilds everything from scratch (it clears this project's tables, so only use it before real data exists). The list below is the same thing step by step.

1. Create a project at [supabase.com](https://supabase.com). The Singapore region is closest to both markets.
2. Open **SQL Editor**, then paste and run these files in order:
   1. `supabase/migrations/0001_init.sql`
   2. `supabase/seed.sql`
   3. `supabase/migrations/0002_open_team.sql`
   4. `supabase/migrations/0003_shoot_days_and_feedback.sql`
   5. `supabase/migrations/0004_no_briefs.sql`
   6. `supabase/migrations/0005_idea_bank.sql`
   7. `supabase/migrations/0006_todos.sql`
   8. `supabase/migrations/0007_todos_basecamp.sql`
   9. `supabase/migrations/0008_admin_access.sql`
3. From **Project Settings > API Keys**, copy the **Project URL** and the **Secret key** (it starts with `sb_secret_`). If you only see the older "anon" and "service_role" keys, copy `service_role`. Treat it like a password: it goes in Vercel only, never in the code.

### 2. Vercel

1. Import this repository in Vercel.
2. Add three environment variables (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_PUBLISHABLE_KEY`. The publishable key (starts `sb_publishable_`) is the public one and only switches on file attachments in the Idea Bank.
3. Deploy, open the link, and set up your own name first so you claim Head of Marketing.

### Which branch is live

Vercel's Production Branch is `main`. Every push to `main` goes live; other branches get their own test links. If Vercel says "No deployments found for main", push once to `main` (or tap Create Deployment on the Deployments page, choose `main`) and set the Production Branch again.

### Local development

```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

`npm run typecheck` and `npm run build` should both pass before you deploy.

### Adding to the database later

New tables must not be readable with the public key. Migrations after `0002` should end with `revoke all on <table> from anon, authenticated;` (the default privileges set in `0002` already cover this in the Supabase SQL editor, but check).
