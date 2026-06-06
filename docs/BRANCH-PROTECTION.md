# Branch protection

The repo's branching model is enforced by two things working together:

1. **GitHub branch protection rules** (configured in the web UI) — these
   are the *real* rules. The repo cannot defend against bypass from the
   `git` side; only GitHub's rules can.
2. **`.github/workflows/branch-protection.yml`** — a workflow that
   *checks* the live branch-protection rules match what we expect. If
   someone disables a required check, the workflow fails on the next push.

This file documents the exact settings to enable so you can copy them
in 30 seconds. The `branch-protection.yml` workflow keeps them honest.

---

## `main` (production)

| Setting | Required value |
|---------|----------------|
| Branch name pattern | `main` |
| Protect matching branches | ✅ on |
| Require a pull request before merging | ✅ on |
| Required approvals | `1` (or more) |
| Dismiss stale pull request approvals when new commits are pushed | ✅ on |
| Require review from Code Owners | ✅ on |
| Require status checks to pass before merging | ✅ on |
| Status checks required | `build-and-smoke` (the CI job) |
| Require branches to be up to date before merging | ✅ on |
| Require conversation resolution before merging | ✅ on |
| Require signed commits | optional (recommended for higher security) |
| Require linear history | optional (we use merge commits by default) |
| Include administrators | ✅ on |
| Allow force pushes | ❌ off |
| Allow deletions | ❌ off |

## `dev` (active development)

Same rules as `main`, **except**:

- Required approvals: `0` may be acceptable for a small team that
  self-merges after CI. With the CODEOWNERS file, GitHub will still
  assign you automatically but the *required* count can stay at `0`
  for fast iteration. **Recommendation: set to `1`** to mirror `main`.

## How to enable in the GitHub UI

1. Go to `https://github.com/shivakovvuru/leave-tracker/settings/branches`
2. Click **Add rule** under "Branch protection rules".
3. Branch name pattern: `main` (and again for `dev`).
4. Tick the boxes per the table above.
5. Click **Create**.

The `branch-protection.yml` workflow will run on the next push and report
green if the rules match.
