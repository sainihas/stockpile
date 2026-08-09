# AGENTS.md

Instructions for AI agents (Claude Code, Codex, Cursor, etc.) working in this repository.

A zero-dependency TypeScript library for real-time stock quotes, financials, and market
indices via Google Finance. Source in `src/`, CLI entry in `bin/`, dual CJS/ESM builds
(`tsconfig.cjs.json` / `tsconfig.esm.json`). It runs on Node, Bun, and Deno — keep it
dependency-free and don't reach for Node-only APIs without a fallback. `README.md` has
the public API.

## Pull requests

<!-- draft-pr-policy -->

`main` is protected: every change lands through a PR, and **every PR is opened as a
draft**.

```bash
gh pr create --draft --title "…" --body "…"
```

Draft is the resting state. A PR stays in draft for as long as it takes and through as
many pushes as it takes — finishing the work is not what takes it out of draft.

Only when Sai asks for it to be merged, and in this order:

1. `gh pr ready <n>` — take it out of draft.
2. `gh pr checks <n> --watch` — wait for the run to finish. Skip it while this repo has
   no `pull_request` workflow (see below): with nothing to report `gh` exits 1 with `no
   checks reported on the '<branch>' branch`, which is not a failing check.
3. `gh pr merge <n> --squash --delete-branch` — merge only on green. If a check fails,
   fix it on the branch, push, and go back to step 2.

Step 2 currently has nothing to wait for: this repo has no workflows at all, so both
builds and the test run have to happen on your machine before a merge.

If CI is ever added, a `pull_request` workflow must list `ready_for_review` in its
`types:` and guard each job on `github.event.pull_request.draft == false`, so drafts stay
free. Either way, don't provoke a run on a draft — no early `gh pr ready`, no
`workflow_dispatch`, no pushing the branch elsewhere.

## Commit attribution

<!-- commit-attribution-policy -->

- All commits in this repo are owned solely by `sainihas <gsainihas@gmail.com>`. Never
  commit under any other identity.
- Never add a `Co-Authored-By:` trailer naming Claude, Anthropic, or any other AI tool.
- Never add the `🤖 Generated with [Claude Code]` footer to a commit message or PR body.

This applies to every agent and every environment — Claude Code, Codex, Cursor, cloud and
scheduled sessions, and edits made through the GitHub web UI. Local git hooks in
`~/.config/git/hooks/` enforce it on Sai's machine, but they do **not** run in cloud
sessions or web edits, so follow the rule directly rather than relying on them.
