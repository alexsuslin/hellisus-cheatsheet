# Hell is Us Implementation Plan

**Goal:** A complete RU/EN checklist, documented and ready for GitHub Pages.

**Architecture:** Static ES modules with bilingual JSON data, browser-local progress and a dependency-free runtime.

**Spec:** [Design](./design.md)

## Constraints

- Node 22+ for development; modern browser for use.
- Relative public asset URLs must work below a GitHub Pages repository path.
- Keep completion IDs independent of language, theme, display order and filtering.
- Use original concise directions and attributed source links.

## Review focus

- Malformed backups cannot replace existing progress.
- Blocked storage leaves the checklist usable and visibly explains persistence failure.
- Filters/search cannot change total progress or destroy checked entries.
- Switching language/theme retains keyboard focus and current section.
- Revisited locations retain distinct stable route IDs.

## Tasks

1. Write model/storage tests; observe failures; implement filtering, counters and safe backup/storage handling; run the suite.
2. Collect all five guide parts and Russian terminology; create original bilingual route data; verify IDs, categories, sections, source links and translation coverage.
3. Implement accessible responsive HTML/CSS/DOM UI, preferences, navigation and backup controls; verify actual browser use and persistence.
4. Add static build/server scripts, Pages CI/deployment and RU/EN READMEs. Run tests, formatter/static analysis, build and subpath smoke checks. Publish when GitHub authentication and repository are available.

## Execution notes

The user's request authorizes building the repository and configuring GitHub Pages. Implement in the supplied empty repository. Avoid adding a separate hosting platform. No commits or publication to a different account without a verified destination.
