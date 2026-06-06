# Contributing

Thanks for taking an interest in Leave Tracker! A few ground rules so the
repo stays tidy.

## Branching

- `main` is the production-ready branch. Tag releases from here.
- `dev` is the active development branch. Open feature branches off `dev`
  using the naming convention `feature/<short-topic>` or `fix/<short-topic>`.
- Open a Pull Request from your feature branch into `dev`. Once `dev` is
  green, fast-forward `main`.

## Commit messages

Use the conventional-commits style — it's short, greppable, and integrates
with auto-changelog tools:

```
feat: add per-project leave export
fix: stop applying leave on weekends
docs: add DEPLOYMENT.md
chore: bump deps
```

`feat:` and `fix:` show up in the release notes; `docs:`, `chore:`,
`refactor:`, `test:` are housekeeping.

## Local setup

```bash
git clone <your-fork>
cd leave-tracker
npm run install:all
npm run dev
```

The Express API runs on `:5000` and the React dev server on `:3000`.
See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for production-style runs.

## Before opening a PR

- [ ] `npm run build` succeeds.
- [ ] The smoke tests in the README still pass.
- [ ] If you changed a server route, added a test call to the bottom of the
      `server.js` and a curl example to the README.
- [ ] If you changed the data model, add a migration in `server/db.js` —
      do not break existing `leave_tracker.db` files.
- [ ] No `console.log` debug output left in.

## Code style

- **JS / TS** — 2-space indent, single quotes, semicolons. The existing code
  follows this — please match it.
- **CSS** — kebab-case class names, hand-written (no framework), edit the
  `:root` variables in `client/src/styles/global.css` rather than hard-coding
  brand colors.
- **API** — keep responses small and JSON-shaped. Errors: `{ "error": "…" }`.
