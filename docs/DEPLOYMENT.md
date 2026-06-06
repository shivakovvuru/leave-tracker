# 🚀 Deployment Guide

The Leave Tracker is designed to be **plug-and-play**: one process serves the API and the built React bundle, on a single port. The default port is `5000`; override with `PORT`.

This document covers every supported target. Pick the section that matches your platform.

---

## Table of contents

1. [Environment variables](#environment-variables)
2. [Local Node / production build](#local-node--production-build)
3. [Docker (recommended)](#docker-recommended)
4. [Behind nginx (TLS + reverse proxy)](#behind-nginx-tls--reverse-proxy)
5. [PM2 (process manager)](#pm2-process-manager)
6. [systemd (bare-metal Linux)](#systemd-bare-metal-linux)
7. [Render](#render)
8. [Fly.io](#flyio)
9. [Railway](#railway)
10. [Generic VPS / cloud VM](#generic-vps--cloud-vm)
11. [Health check & first-login checklist](#health-check--first-login-checklist)
12. [Backups & upgrades](#backups--upgrades)

---

## Environment variables

All variables are read by the Express process in `server/server.js` / `server/db.js`.

| Var      | Default | Purpose |
|----------|---------|---------|
| `PORT`   | `5000`  | TCP port the server binds to |
| `NODE_ENV` | (unset) | Set to `production` in deploy targets — silences noisy dev errors and serves the React build with cache headers |
| `HOST`   | `0.0.0.0` | Bind address; usually left as default |

> The SQLite database path is `server/data/leave_tracker.db` and is not env-configurable on purpose — it lives next to the app, which makes backup as simple as copying one file.

A documented template lives at `deploy/.env.example`. Copy it to `.env` next to `server.js` (or use your platform's env-var UI):

```bash
cp deploy/.env.example .env
# edit .env, then:
set -a; source .env; set +a; node server/server.js
```

---

## Local Node / production build

Requires **Node 18+** and **npm 9+**.

```bash
# 1) install everything
npm run install:all

# 2) build the React bundle
npm run build

# 3) start the API + static server
npm start
# → "Leave Tracker API running on http://localhost:5000"
```

Open `http://localhost:5000`. The React SPA is served by Express from `client/build/`.

---

## Docker (recommended)

`deploy/Dockerfile` is multi-stage: it builds the React bundle in an intermediate image, then copies the bundle + server into a slim runtime image and runs as a non-root user.

```bash
docker compose -f deploy/docker-compose.yml up --build
# → Listening on http://localhost:5000
```

Useful commands:

```bash
# stop and remove the container
docker compose -f deploy/docker-compose.yml down

# follow logs
docker compose -f deploy/docker-compose.yml logs -f

# open a shell inside the running container
docker compose -f deploy/docker-compose.yml exec app sh

# run a one-off command (e.g. list data dir)
docker compose -f deploy/docker-compose.yml exec app ls -la /app/server/data
```

The SQLite file is persisted on the named volume `lt_data` so it survives container recreation. To back it up:

```bash
docker run --rm -v lt_data:/data -v "$PWD":/backup \
  alpine cp /data/leave_tracker.db /backup/leave_tracker_$(date +%F).db
```

---

## Behind nginx (TLS + reverse proxy)

`deploy/nginx.conf` shows a complete example. The short version:

```nginx
server {
  listen 80;
  server_name leave.example.com;

  location / {
    proxy_pass         http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
  }
}
```

Add `listen 443 ssl http2;` + cert paths from Let's Encrypt (`certbot --nginx`) to enable HTTPS. The Express app does not need to be modified — it only needs to see `X-Forwarded-Proto` (already set above) if you later add redirect logic.

Reload nginx after editing:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## PM2 (process manager)

```bash
npm i -g pm2
npm run install:all
npm run build

pm2 start scripts/start.js --name leave-tracker --time
pm2 save
pm2 startup    # follow the printed command to enable boot-start
```

Useful:

```bash
pm2 status
pm2 logs leave-tracker
pm2 restart leave-tracker
pm2 stop leave-tracker
```

---

## systemd (bare-metal Linux)

`deploy/leave-tracker.service` is a ready-to-use unit. Install:

```bash
# 1) build the app as the deploy user
sudo -u lt-deploy bash -c 'cd /opt/leave-tracker && npm ci && npm run build'

# 2) install the service file
sudo cp deploy/leave-tracker.service /etc/systemd/system/leave-tracker.service
sudo systemctl daemon-reload
sudo systemctl enable --now leave-tracker

# 3) check
systemctl status leave-tracker
journalctl -u leave-tracker -f
```

The unit runs the app as a dedicated `lt-deploy` user, restarts on failure, and reads its working directory from `/opt/leave-tracker`.

---

## Render

1. Push the repo to GitHub.
2. **New → Web Service** → connect the repo.
3. **Environment**: Node
4. **Build command**: `npm run install:all && npm run build`
5. **Start command**: `npm start`
6. **Health check path**: `/api/health`
7. Add a **Disk** mounted at `server/data` so the SQLite file persists across deploys (otherwise the DB resets on every redeploy).
8. Deploy. Render assigns a URL on `onrender.com`.

---

## Fly.io

```bash
# one-time
fly launch --no-deploy      # creates fly.toml + Dockerfile detection
fly volumes create lt_data --size 1
```

Edit `fly.toml` to mount the volume at `/app/server/data` and add the `NODE_ENV=production` env var. Then:

```bash
fly deploy
fly open
```

---

## Railway

1. **New Project → Deploy from GitHub repo**.
2. Add a **Volume** mounted at `/app/server/data`.
3. **Variables**: set `NODE_ENV=production`, `PORT=8080` (Railway's default).
4. **Build command**: `npm run install:all && npm run build`
5. **Start command**: `npm start`
6. Add a health-check on `/api/health`.

---

## Generic VPS / cloud VM

The shortest path on Ubuntu 22.04+:

```bash
# 1) install Node
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs build-essential

# 2) install + build
git clone <your-fork> /opt/leave-tracker
cd /opt/leave-tracker
sudo useradd -r -m lt-deploy
sudo chown -R lt-deploy:lt-deploy /opt/leave-tracker
sudo -u lt-deploy bash -c 'npm ci && npm run build'

# 3) run under systemd (see above) or PM2
sudo cp deploy/leave-tracker.service /etc/systemd/system/
sudo systemctl enable --now leave-tracker
```

For TLS, run `sudo apt install -y nginx certbot python3-certbot-nginx` and follow [Behind nginx](#behind-nginx-tls--reverse-proxy).

---

## Health check & first-login checklist

The server exposes:

```
GET /api/health
→ {"status":"ok","timestamp":"2026-06-06T..."}
```

After first deploy:

1. Hit `/api/health` — confirm 200.
2. Visit `/` — confirm the React login page renders.
3. Log in as `admin@company.com` / `admin123` and **change the admin password** under **My Profile** (this invalidates all sessions for that user, including any other browser logged in as the demo admin).
4. Approve any pending signups (none on first boot — the demo seed only creates already-approved users).
5. Add the first real project and team under **Projects**.

---

## Backups & upgrades

### Backups

The entire persistent state is **one file**: `server/data/leave_tracker.db`. A daily backup is enough for most teams:

```bash
# cron entry, 02:00 every day
0 2 * * *  cp /opt/leave-tracker/server/data/leave_tracker.db \
              /backups/leave_tracker_$(date +\%F).db
```

For Docker, see the `docker run --rm -v lt_data:/data …` snippet above.

### Upgrades

```bash
# 1) pull the new code
git pull --rebase

# 2) install + build
npm ci
npm run build

# 3) restart the running process
#    - PM2:    pm2 restart leave-tracker
#    - systemd: sudo systemctl restart leave-tracker
#    - Docker:  docker compose -f deploy/docker-compose.yml up -d --build
```

`server/db.js` is **idempotent** — schema changes (new columns, new tables) are applied on every start, and pre-existing data is preserved.
