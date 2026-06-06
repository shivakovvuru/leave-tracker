# 📅 Leave Tracker

A full-stack single-page application for tracking leaves, public holidays, and unplanned absences across project teams.

- **Frontend** — React 18 + TypeScript (CRA build), Recharts, date-fns, hand-written modern CSS in an **Accenture-style purple & white** theme.
- **Backend** — Node.js + Express REST API.
- **Database** — SQLite via `sql.js` (pure JS / WASM, no native build required). Single file: `server/data/leave_tracker.db`.
- **Auth** — Email + password (PBKDF2-SHA256, 10k iterations, 16-byte salt), bearer tokens stored in `sessions` table, admin/approved gating, password change invalidates all sessions.
- **Notifications** — In-app bell feed generated on every leave create / approve / reject / cancel / change.
- **Deployment** — Plug-and-play: `docker compose up` (or `npm start` from the built artifact) brings the whole app up on a single port.

> Detailed architecture, request lifecycle, and data-flow diagrams live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
> Step-by-step deployment instructions for every supported target live in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 📂 Repository layout

```
leave-tracker/
├── client/                 React + TypeScript SPA
│   ├── public/             Static assets (logo, hero, empty-state SVGs)
│   ├── src/
│   │   ├── components/     Reusable UI (Sidebar, Header, Modal, FormControls, Icons)
│   │   ├── pages/          One component per route (Dashboard, Projects, …)
│   │   ├── styles/         global.css (Accenture-style purple & white theme)
│   │   ├── api.ts          Typed fetch client + per-resource helpers
│   │   ├── AuthContext.tsx Token + user + notifications context
│   │   ├── types.ts        Shared TypeScript types
│   │   └── index.tsx       React root
│   ├── package.json
│   └── tsconfig.json
│
├── server/                 Express REST API
│   ├── db.js               sql.js bootstrap, schema, seed, password helpers
│   ├── server.js           Express routes, auth/RBAC, notifications
│   ├── package.json
│   └── data/               SQLite database lives here (gitignored)
│
├── docs/
│   ├── ARCHITECTURE.md     Request flow, data model, RBAC
│   ├── DEPLOYMENT.md       Docker, Node, nginx, PM2, cloud platforms
│   └── USER-GUIDE.md       Admin & member workflows
│
├── scripts/
│   ├── dev.js              Cross-platform dev runner (concurrent client + server)
│   ├── dev.ps1             Windows convenience wrapper
│   └── start.js            Production entry point (built client + server)
│
├── deploy/
│   ├── Dockerfile          Multi-stage build → single runtime image
│   ├── docker-compose.yml  One-command `up` for the full stack
│   ├── nginx.conf          Reverse proxy + static-asset caching example
│   ├── leave-tracker.service  systemd unit for Linux servers
│   └── .env.example        All runtime env vars documented
│
├── package.json            Top-level convenience scripts (install / build / start)
├── .gitignore
├── LICENSE
└── README.md               (this file)
```

---

## 🚀 Quick start (local development)

### Option A — Node only (simplest, no Docker)

Requires **Node 18+** and **npm 9+**.

```bash
# from the repo root
npm run install:all   # installs client + server dependencies
npm run dev           # runs API on :5000 and the React dev server on :3000
```

Open <http://localhost:3000>. The Vite/CR dev server proxies `/api/*` to Express.

### Option B — Docker (one command)

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Open <http://localhost:5000>. The container serves the API **and** the prebuilt React bundle from a single Express process. (See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full Docker guide.)

### Demo credentials

After first boot the database is seeded with these accounts:

| Role   | Email                  | Password    |
|--------|------------------------|-------------|
| Admin  | `admin@company.com`    | `admin123`  |
| Member | `aarav@company.com`    | `member123` |
| Member | `priya@company.com`    | `member123` |
| Member | `rohan@company.com`    | `member123` |
| Member | `sara@company.com`     | `member123` |
| Member | `vikram@company.com`   | `member123` |
| Member | `anita@company.com`    | `member123` |

The first admin must change `admin123` after first login via **My Profile**.

---

## 🛠️ Build & run scripts (top-level)

| Script | What it does |
|--------|--------------|
| `npm run install:all` | Installs `client/` + `server/` dependencies in one shot |
| `npm run dev` | Runs both servers concurrently with hot-reload |
| `npm run server` | Runs only the Express API (port 5000) |
| `npm run client` | Runs only the React dev server (port 3000) |
| `npm run build` | Produces an optimized production bundle in `client/build/` |
| `npm start` | Runs the production entry point (server serves the prebuilt client) |

> After `npm run build`, the entire app can be served by a single Node process:
> ```
> cd server && NODE_ENV=production node server.js
> ```
> It binds to port `5000` by default and serves both the API and the static `client/build/` assets.

---

## 🎨 Theming

The default theme is **Accenture-inspired** — primary `#A100FF` (Accenture Purple), deep accent `#7300E6`, white surfaces, and a soft lavender wash. All colors are CSS variables at `:root` in `client/src/styles/global.css` — change them in one place.

| Variable | Default | Use |
|----------|---------|-----|
| `--acn-purple` | `#A100FF` | Primary buttons, focus rings, sidebar |
| `--acn-purple-dark` | `#7300E6` | Hover, gradient end |
| `--acn-purple-soft` | `#F4E6FF` | Tinted backgrounds, "purple" badges |
| `--acn-bg` | `#FFFFFF` | App surface |
| `--acn-bg-soft` | `#F7F4FB` | Subtle wash (page background) |
| `--acn-text` | `#1A1A1A` | Primary text |

---

## 🧪 Smoke test

```bash
# Admin login
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.com","password":"admin123"}'
# → 200 OK with {"token":..., "user":{...}, "member":null}

# Health
curl http://localhost:5000/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## 📖 Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — request lifecycle, data model, RBAC, notification flow, build/runtime overview.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Docker, plain Node, nginx, PM2, systemd, Render, Fly.io, Railway, generic VPS.
- [`docs/USER-GUIDE.md`](docs/USER-GUIDE.md) — admin & member walkthrough.

## 📄 License

Internal use. See `LICENSE` if present.
