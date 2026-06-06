# 🏗️ Architecture & Data Flow

This document is the canonical source for how the Leave Tracker is wired together. It is intentionally implementation-focused so an on-call engineer can debug the system end-to-end.

## High-level diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
│  │  AuthContext │  │  Pages       │  │  Recharts  │  │   Bell   │  │
│  │  (token +    │  │  (Dashboard, │  │  (Pies,    │  │  notif   │  │
│  │   user,      │  │   Calendar,  │  │   lines,   │  │  dropdown│  │
│  │   poll 30s)  │  │   Reports,…) │  │   bars)    │  │          │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  │
│         └──────┬───────────┴────────────────┴─────────────┘        │
│                │  fetch /api/*  (Bearer token, JSON)               │
└────────────────┼───────────────────────────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│              Express server  (Node.js, port 5000)                  │
│                                                                    │
│   cors  •  express.json  •  auth middleware  •  admin/approved gates│
│                                                                    │
│   Routes                                                            │
│   ───────                                                           │
│   POST   /api/auth/signup        create pending user               │
│   POST   /api/auth/login         email+password → bearer token      │
│   POST   /api/auth/logout        invalidate token                  │
│   GET    /api/auth/me            current user + linked member       │
│   PUT    /api/auth/profile       update name / mobile / password    │
│   GET    /api/auth/pending-users (admin)                            │
│   POST   /api/auth/approve/:id   (admin) — also creates member row │
│   POST   /api/auth/reject/:id    (admin)                            │
│   GET    /api/years              fiscal years (filter active)       │
│   POST/PUT/DELETE /api/years*    (admin)                            │
│   GET/POST/DELETE /api/roles*                                        │
│   GET/POST/PUT/DELETE /api/projects*                                 │
│   GET/POST/PUT/DELETE /api/members*                                  │
│   GET/POST/PUT/DELETE /api/leaves*     ← working-day calc, year gate│
│   GET/POST/DELETE /api/holidays*                                     │
│   GET    /api/reports/summary     KPIs + byType/byMember/byMonth    │
│   GET    /api/notifications       bell feed                         │
│   POST   /api/notifications/mark-read                                │
│                                                                    │
│   Side-effects on each leave write:                                  │
│     • POST /api/leaves (member)   → notify all admins               │
│     • PUT  /api/leaves (admin)    → notify member on approve/reject │
│     • PUT  /api/leaves cancel     → notify member + admins          │
│     • PUT  /api/leaves change     → notify admins                   │
└────────────────┬───────────────────────────────────────────────────┘
                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  db.js  (sql.js — pure JS SQLite)                                   │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────────┐          │
│  │  users   │  │ sessions │  │ leaves │  │ notifications │  …      │
│  └──────────┘  └──────────┘  └────────┘  └───────────────┘          │
│                                                                    │
│  In-memory SQL.Database  ↔  persist()  ↔  leave_tracker.db file    │
└────────────────────────────────────────────────────────────────────┘
```

## Request lifecycle (example: a member applies for leave)

1. **Browser** — `MyLeaves.tsx` calls `Leaves.create({ leave_type, start_date, end_date, reason })` in `api.ts`.
2. **api.ts** attaches `Authorization: Bearer <token>` from `localStorage.lt_token` and POSTs JSON to `/api/leaves`.
3. **Express** matches the route, runs `authRequired` → loads the user from the `sessions` table by token → runs `approvedOnly` (rejects un-approved sign-ups) → enters the `POST /api/leaves` handler.
4. **Handler** — verifies the leave type, checks both dates are within today..today+90 days and the working-day count > 0, then checks there is no overlapping non-rejected leave for the same member.
5. **Notification side-effect** — for member-created leaves, `notifyAllAdmins('leave_submitted', …)` inserts a row into `notifications` for every admin user.
6. **Persistence** — `db.run()` mutates the in-memory `SQL.Database`; `persist()` exports the database and writes `server/data/leave_tracker.db`.
7. **Response** — JSON `{ id, days, status }` is returned; the client refreshes its list. Within 30 s the admin's bell polls `/api/notifications` and the unread badge appears.

## Role-based access

- `authRequired` — every protected route looks up the bearer token in `sessions` and loads the user.
- `adminOnly` — rejects with `403` if `user.role !== 'admin'`.
- `approvedOnly` — rejects with `403 'Account pending admin approval'` if `user.approved === 0`.
- Members can only read leaves for themselves and their project teammates; only admins can list, edit, or delete every record.
- Self-service profile (`PUT /api/auth/profile`) lets any signed-in user edit their own name / mobile and change their password. A successful password change deletes all sessions for that user, forcing re-login.

## Data model

| Table             | Purpose                                          |
|-------------------|--------------------------------------------------|
| `projects`        | Projects with code, dates, status                |
| `roles`           | Roles (PM, TL, Dev, QA, etc.)                    |
| `members`         | Team members linked to a project & role          |
| `leaves`          | Leave records (Leave / Public Holiday / Unplanned) |
| `public_holidays` | Company-wide public holidays                     |
| `fiscal_years`    | Years that gate the calendar and leave-create    |
| `users`           | Login accounts (email, hashed password, role, profile fields, approval) |
| `sessions`        | Bearer tokens used by `Authorization: Bearer …` |
| `notifications`   | In-app bell notifications generated on leave events |

Working-day calculation (used in leave records) automatically excludes **Saturday** and **Sunday**, and is computed in the **server's local timezone** to avoid off-by-one day bugs.

## Leave validation (server-enforced)

`POST /api/leaves` and all `PUT /api/leaves/:id` mutations that change dates or status go through `validateLeaveChange(memberId, start, end, ignoreId)` which enforces:

- `start <= end`
- `start >= today`
- `start, end <= today + 90 days`
- working-day count > 0 (i.e. range isn't entirely weekends)
- no overlap with another non-Rejected leave for the same member

Client-side `min` / `max` attributes on date inputs and a pre-validate in `save()` mirror these rules so the user sees the error before submitting.

## Single-file database (sql.js) — why

`server/db.js` uses [sql.js](https://github.com/sql-js/sql.js) so the app needs **no native build** and runs identically on Windows, macOS, Linux and inside containers. The trade-off is that writes are explicit: every `run`/`exec` calls `persist()`, which serializes the in-memory database back to `leave_tracker.db`. For an app of this size (a single team, a few hundred members, single-tenant) that is the right simplicity/cost balance.

## Build artifacts

- `client/build/` — production React bundle (created by `npm run build`). Served as static assets by Express in production.
- `server/data/leave_tracker.db` — SQLite database file. Auto-created on first start, seeded with demo data.

## Runtime ports

| Port | Process | When |
|------|---------|------|
| 3000 | `react-scripts start` (CRA dev server) | `npm run dev` only |
| 5000 | Express server (API + static build) | `npm start`, Docker, production |

In dev mode the React dev server on `:3000` proxies `/api/*` to Express on `:5000` (see `client/package.json` → `proxy`). In production, Express on `:5000` serves the prebuilt `client/build/` and the API; no separate dev server is needed.
