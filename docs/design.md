# Hell is Us checklist

Build a complete, browser-local companion to the game, inspired by the Dark Souls 3 Cheat Sheet. Publish static files on GitHub Pages. Support Russian and English throughout the interface and guide, with instant switching and stable progress IDs independent of language.

## Content

Use all five chronological PowerPyx walkthrough parts, with links back to the source and original concise instructions. Verify Russian terminology against GameShelter. Include every numbered collectible or interaction listed by the chronological guide, story checkpoints, and explicit missable deadlines. Preserve the source order and revisit sections. Distinguish checklist entries from unique collectibles: an interaction may recur as a quest progresses. Do not present the source's inconsistent aggregate number as a verified checklist total.

## Architecture

Buildless HTML, CSS and ES modules; JSON owns the bilingual guide. A pure model owns filtering, progress and backup validation. A storage module tolerates inaccessible/corrupt localStorage. The DOM app owns rendering and accessible interactions. No runtime dependencies or third-party fonts. Node scripts serve and copy only public assets to dist. GitHub Actions tests and builds before deploying the Pages artifact.

## Experience

Chronological act/area navigation, category and missable filters, search across both languages, hide completed, section counters and overall progress. A restrained field-journal visual style, defaulting to the system colour scheme and remembering user choices. Mobile navigation and large checkbox targets. Export/import JSON backups, guarded reset and explanatory source/FAQ content.

## Verification

Test combined filters, independent language/progress, corrupt/blocked storage, strict backup validation, stable IDs and full bilingual data. Verify browser interactions, reload persistence, both themes, mobile layout and repository-subpath asset resolution. Deployment requires a reachable GitHub repository and authenticated GitHub account.
