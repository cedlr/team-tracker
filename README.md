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
| `/` | `metric-card`, `bar-chart`, `activity-heatmap` |
| `/tasks`, `/projects/[id]` | `kanban-board` (moves and edits saved) |
| `/projects` | `sortable-data-table`, `progress`, `badge` |
| `/timeline` | `gantt-timeline` (drag to reschedule saves dates) |
| `/calendar` | `month-calendar` (leave + due dates; new event on Approved leave = leave request) |
| `/people` | `team-directory` |
| `/leave` | `team-directory` time off page (approve/decline) + `dialog`, `date-range-picker`, `select`, `textarea` request form |
| `/utilization` | `bar-chart`, `sortable-data-table`, `usage-meter`, `segmented-control` |
| `/settings` | `profile-page`, `roles-permissions`, `invite-people` |

Alignment edits to Arc source are marked `team-tracker:` (login-split props, screen-shell app provider).

## Server Actions (`src/app/actions`)

`checkIn`, `upsertTask`, `moveTasks`, `requestLeave`, `decideLeave`, `selectTeam`, `loginWithPassword`, `logout`.

## Known limits

- Arc screens that only run on their own sample data: `metrics-dashboard`, `kpi-drilldown`, `project-board`, `settings-page`, `roles-permissions`, `invite-people`, `activity-feed`, `task-breakdown`, `week-calendar`. They are installed; the routes above use the ones that take real data.
- `gantt-timeline` draws owners from Arc's sample portrait set, so owners show only for members whose `avatar` is an Arc portrait id.
- `team-directory` keeps its sample office clocks and a fixed "now" for its time off strip.
