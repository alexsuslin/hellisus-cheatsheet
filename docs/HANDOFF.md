# Handoff

Use the [README](../README.md) for local setup and the [design notes](design.md)
when changing the checklist, progress storage, or browser behavior.

## Outcome and acceptance

- Adopt project-scaffolding v0.3.6 with a linked handoff and the documented
  order for building and running browser tests.
- Scope covers agent instructions, handoff, and adoption provenance.

## Current state

- Base revision: `4134526` on local `main`, with a clean working tree before adoption.
- The site is a static RU/EN Hell is Us checklist. It stores progress in the
  browser and supports transfers between devices through QR codes and links.
- The latest base commit adjusts progress links for Telegram sharing.
- The [Pages workflow](../.github/workflows/pages.yml) checks pull requests
  and deploys from `main`. The README lists the Pages URL.

## Verification

| Revision or working state | Check | Result |
| --- | --- | --- |
| `4134526` | Installed doctor v0.3.6 | Detected Node.js and npm commands from package metadata |
| Adoption working tree | npm checks, build, and browser tests | Pending |

Use Node.js 22 or newer. Run these commands from the repository root.

```sh
npm ci
npm run check
npm test
npm run build
npm run test:browser
```

Playwright serves the built site under the repository path. On Windows it uses
Microsoft Edge. On Linux and macOS, install Chromium with
`npx playwright install chromium` before running the browser tests.

## Next action

Review the adoption diff. Before the next application change, run the checks
relevant to that change and record the result against the tested revision.
