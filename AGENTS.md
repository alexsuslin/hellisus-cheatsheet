# Project instructions

## Entry points

- For continuing work or changing scope, read [the current handoff](docs/HANDOFF.md).
- Use the existing README for setup and architecture; read specialist docs only when relevant.
- Detected stack: node. Preserve the existing toolchain.


## Candidate commands

These were inferred from metadata, not run. Confirm their prerequisites and side effects
before using them; replace this list with verified project commands as work proceeds.

- test: `npm run test` (from package.json scripts.test; not yet verified).
- check: `npm run check` (from package.json scripts.check; not yet verified).
- build: `npm run build` (from package.json scripts.build; not yet verified).
- Browser tests: run `npm run build` before `npm run test:browser`. Playwright serves the built site from `dist/`.
- bootstrap: `npm ci` (from package-lock.json; not yet verified).

## Working agreements

- Define the requested outcome and its acceptance evidence before substantial changes.
- Preserve unrelated edits and other sessions' work. Check the branch/worktree before integrating.
- Continue ordinary reversible work within the user's authorized scope without repeated approval.
- Use targeted checks for changed behavior; broaden verification when the change warrants it.
- Keep secrets, personal data, local configuration and generated artifacts out of commits.
- Publishing, deployment and live-data changes must stay within the user's explicit scope.

## Completion and handoff

- Update the linked handoff when scope, evidence, a blocker, or the next action changes.
- Separate implemented, verified, integrated and deployed. Do not infer one from another.
- Record the revision, commands and outcomes; mark unavailable or skipped checks explicitly.
- State the next concrete action and who can take it. A planned test is not evidence.
