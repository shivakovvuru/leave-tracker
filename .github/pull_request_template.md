<!--
Thanks for opening a PR! Please fill in the sections below — they help
reviewers understand your change and speed up the merge.

Branching rule: this PR must target `dev`. PRs that target `main`
will be closed.
-->

## Summary
<!-- One or two sentences describing what this PR does. -->

## Type of change
- [ ] feat: new feature
- [ ] fix: bug fix
- [ ] refactor: code change that neither fixes a bug nor adds a feature
- [ ] docs: documentation only
- [ ] chore: build / tooling / CI only

## Linked issue
<!-- Closes #123, or "n/a" -->

## How was it tested?
- [ ] `npm run build` passes
- [ ] CI smoke tests pass on the PR
- [ ] Manually verified in the browser (URL: http://localhost:5000)

## Screenshots (if UI changed)
<!-- Drag and drop images here, or paste a link. -->

## Checklist
- [ ] I branched off `dev` (not `main`).
- [ ] I did **not** push directly to `main`.
- [ ] I did not commit `node_modules/`, `client/build/`, `server/data/*.db`,
      secrets, or build output.
- [ ] I updated docs (README / docs/*) if behavior changed.
- [ ] I added / updated a data-model migration in `server/db.js` if the
      schema changed.
