# Contributing

Thanks for taking an interest in Leave Tracker! This document describes the
branching model, commit conventions, and the protection rules in place.

## Branching model

The repo uses a **two-branch, PR-only** flow:

```
   feature/foo ──┐
   feature/bar ──┤
                 ▼
                dev ◄─── hotfix/critical (off main, merged back to dev & main)
                 │
                 ▼   (PR dev → main, requires review + CI green)
                main ◄── tag (vX.Y.Z)
```

| Branch | Purpose | Direct push? | PR target |
|--------|---------|--------------|-----------|
| `main` | Production. Always green. Tagged for releases. | ❌ | receives only PRs from `dev` |
| `dev`  | Active development. | ❌ | receives PRs from `feature/*` and `hotfix/*` |
| `feature/<topic>` | A unit of work. | ✅ on your own fork, then PR into `dev` |
| `hotfix/<topic>`   | A critical fix that has to ship now. | ✅ on your own fork, then PR into `main` *and* back-merge into `dev` |

Both `main` and `dev` are protected in the GitHub UI:
- "Require a pull request before merging" ✅
- "Require approvals" ≥ 1 ✅
- "Require Code Owner review" ✅
- "Require status checks to pass before merging" ✅ (the `build-and-smoke` CI job)
- "Include administrators" ✅
- "Allow force pushes" ❌

See [`docs/BRANCH-PROTECTION.md`](docs/BRANCH-PROTECTION.md) for the exact
settings, and `.github/workflows/branch-protection.yml` for an automated
drift-check.

## Day-to-day workflow

```bash
# 1. Sync dev
git checkout dev
git pull --rebase

# 2. Branch off
git checkout -b feature/short-topic

# 3. Code, commit, push
git commit -m "feat: …"
git push -u origin feature/short-topic

# 4. Open a PR targeting dev:
#    https://github.com/shivakovvuru/leave-tracker/compare/dev...feature/short-topic
#    - Fill in the PR template
#    - Request review from the Code Owner
#    - Wait for CI to pass
#    - Squash-merge or merge-commit once approved

# 5. Periodically: dev → main
#    Open a PR from dev into main, require review + CI green, merge.
#    Then tag:
git checkout main && git pull
git tag -a vX.Y.Z -m "…"
git push origin vX.Y.Z
```

## Commit messages — conventional commits

Use the conventional-commits style. The CI tooling and release scripts
rely on the prefix.

```
feat: add per-project leave export
fix: stop applying leave on weekends
docs: add DEPLOYMENT.md
chore: bump deps
refactor: split leaves router
test: add overlap regression test
```

`feat:` and `fix:` lines show up in the release notes.

## Local setup

```bash
git clone https://github.com/shivakovvuru/leave-tracker.git
cd leave-tracker
npm run install:all
npm run dev
```

The Express API runs on `:5000` and the React dev server on `:3000`.

## Before opening a PR

- [ ] Branched off `dev` (not `main`).
- [ ] `npm run build` succeeds.
- [ ] `npm start` boots and the smoke checks in `.github/workflows/ci.yml` all pass.
- [ ] No `console.log` debug output left in.
- [ ] No `node_modules/`, `client/build/`, `server/data/*.db`, secrets, or build output committed.
- [ ] If you changed a server route, add a curl example in the README.
- [ ] If you changed the data model, add a migration in `server/db.js` (idempotent — do not break existing `leave_tracker.db` files).
- [ ] If you changed the UI, attach before/after screenshots to the PR.

## Code style

- **JS / TS** — 2-space indent, single quotes, semicolons. The existing code follows this; match it.
- **CSS** — kebab-case class names, hand-written (no framework). Edit the `:root` variables in `client/src/styles/global.css` rather than hard-coding brand colors.
- **API responses** — keep them small and JSON-shaped. Errors: `{ "error": "…" }`.
