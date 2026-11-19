# Team tracker

Track your teams' tasks, daily check-ins, leave and utilization. Built with Next.js 16 (App Router), Arc UI (free + Pro), Auth.js v5 and Upstash Redis. No SQL database and no separate backend: pages render on the server and changes go through Server Actions.

## Stack

| Need | Choice |
| --- | --- |
| UI | Arc UI screens, blocks and components (`src/components/arc`, installed with the shadcn CLI) |
| Data | Upstash Redis (`@upstash/redis`, `Redis.fromEnv()`), local `./.data/kv.json` fallback in dev |
| Auth | Auth.js v5 Credentials (email + password, bcryptjs), JWT cookie sessions |
| Validation | zod |
| Dates | date-fns |

## Run locally

```bash
npm install
cp .env.example .env.local      # then fill AUTH_SECRET (npx auth secret)
npm run seed -- --reset         # sample data into ./.data/kv.json (or Redis if its env vars are set)
npm run dev                     # http://localhost:3000
```

Sign in with the seeded admin: `admin@teamtracker.dev`. The dev password is `SEED_ADMIN.password` in `scripts/seed.ts`. Change it (re-run the seed with a new value) before sharing a deployment.

Leave `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` empty to use the local JSON store. Set them to use Redis. `npm run redis:check` does a write, read and delete round trip.

## Deploy on Vercel

1. Push the repo and import it in Vercel.
2. Storage → Marketplace → **Upstash Redis**: create a database in **ap-southeast-1 (Singapore)** and connect it to the project. This sets `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (older `KV_REST_API_*` names also work).
3. Add `AUTH_SECRET` in Project → Settings → Environment Variables.
4. Deploy. `vercel.json` pins functions to `sin1` so they sit next to the database.
5. Seed once from your machine with the production env vars pulled locally: `vercel env pull .env.local && npm run seed`.

`ARC_PRO_TOKEN` is only needed on machines that install or update Arc Pro items (`npx shadcn@latest add @uiarc-pro/<id>`); `components.json` reads it as `Bearer ${ARC_PRO_TOKEN}`. Never commit it.

## Teams

Members belong to one or more teams (`memberships` with a capacity share per team). The team switcher is the workspace switcher in Arc's screen shell. The chosen team is stored in the `tt-team` cookie; `/any-page?team=<id>` also switches it. Projects, tasks, leave, attendance and utilization are scoped to the selected team.

## Data model (Redis keys, `src/lib/keys.ts`)

| Key | Value |
| --- | --- |
| `team:{id}`, set `teams` | Team |
| `member:{id}`, set `members`, `member-email:{email}`, set `members:team:{teamId}` | Member (memberships, capacity) |
| `project:{id}`, set `projects:team:{teamId}` | Project |
| `task:{id}`, sets `tasks:team:{teamId}`, `tasks:project:{id}`, `tasks:member:{id}` | Task |
| `leave:{id}`, set `leaves:team:{teamId}` | Leave request |
| hash `att:{memberId}:{yyyy-mm}` | day → { status, teamId, at }: one HSET per check-in |
| hash `time:{memberId}:{yyyy-mm-dd}` | taskId → { hours, teamId } |

Utilization = hours logged on the team's tasks ÷ (capacity share for the team − approved leave on working days) (`src/lib/utilization.ts`).

## Routes

| Route | Arc pieces |
| --- | --- |
| `/login` | `login-split` (email + password, wired to Auth.js) |
| shared frame | `screen-shell` with one nav config (`src/components/app/nav.ts`), team switcher, account menu, daily check-in button |
| `/` | `metric-card`, `bar-chart`, `activity-heatmap`, `activity-feed` (recent task, leave and check-in events) |
| `/tasks` | `kanban-board` (create, edit and move saved) |
| `/projects` | `sortable-data-table`, `progress`, `badge` |
| `/projects/[id]` | `kanban-board` scoped to the project, then `task-breakdown` of that project's tasks |
| `/timeline` | `gantt-timeline` (real members; drag to reschedule saves dates) |
| `/calendar` | `month-calendar` (leave, task deadlines, holidays; create and delete persist) |
| `/people` | `team-directory` (real members, Kuala Lumpur clocks, today's date) |
| `/leave` | `team-directory` time off page (approve/decline) + `dialog`, `date-range-picker`, `select`, `textarea` request form |
| `/utilization` | `bar-chart`, `sortable-data-table`, `usage-meter`, `segmented-control`, plus an hours log on a task |
| `/settings` | `profile-page` (edit saves), password change, rename/add team, `roles-permissions` (roles save), `invite-people` (new member + temporary password) |

Alignment edits to Arc source are marked `team-tracker:` (login-split props, screen-shell app provider).

## Server Actions (`src/app/actions`)

`checkIn`, `checkOut`, `upsertTask`, `moveTasks`, `logHours`, `requestLeave`, `decideLeave`, `cancelLeave`, `createCalendarItem`, `deleteCalendarItem`, `updateProfile`, `changePassword`, `inviteMember`, `setMemberRole`, `renameTeam`, `createTeam`, `saveRoleGrants`, `selectTeam`, `loginWithPassword`, `logout`.

Leads and admins approve leave, invite people, change roles and manage teams. Members can update their own profile and password, log time, check in and out, and request leave.

Dates and "today" use `Asia/Kuala_Lumpur` (`src/lib/time.ts`).

## Verify

```bash
npm run build
npm run lint
npm run e2e    # seeds ./.data, starts the production server, Playwright smoke test
```

Playwright needs Chromium: `npx playwright install chromium`.

## Still on sample data

These Arc screens are installed and unchanged as demos. They do not fit a team tracker, so no route renders them:

- `metrics-dashboard` and `kpi-drilldown` are website analytics, not team utilization.
- `project-board` is a sample project home. Project detail uses the kanban board plus `task-breakdown` instead.
- `settings-page` is a sample account form. Settings uses `profile-page`, `roles-permissions` and `invite-people`.
- `week-calendar` is a sample week planner. The calendar route uses `month-calendar`, which is where events are created and deleted.

`activity-feed` and `task-breakdown` take real team data (the dashboard feed, and the breakdown under a project). `roles-permissions` and `invite-people` save. The permission matrix is stored on the team; what the server enforces is the admin / lead / member role.
