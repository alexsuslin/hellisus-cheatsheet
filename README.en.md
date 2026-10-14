# Hell is Us — Walkthrough Checklist

**English** · [Русский](./README.md)

**Website:** [alexsuslin.github.io/hellisus-cheatsheet](https://alexsuslin.github.io/hellisus-cheatsheet/)

An interactive **Hell is Us** field guide, inspired by the [Dark Souls 3 Cheat Sheet](https://zkjellberg.github.io/dark-souls-3-cheat-sheet/). Check off your route, track discoveries and keep important NPC conversations and good deeds in sight.

## Features

- Instant **English/Russian switching**, including walkthrough directions.
- **Light and dark themes**, initially following your system preference and remembering your choice.
- A chronological route through all three acts, locations and revisits.
- NPCs, good deeds, mysteries, research items, drone modules, glyphs, relics, weapons, defensive items, timeloops, vaults and baseball caps.
- Warnings for permanently missable actions.
- Search across both languages, act/category filters and hide completed.
- Overall and location progress, saved in your browser.
- An **Achievements** view with all 40 achievements and the PS5 platinum, search, filters and missable warnings.
- Links between achievements and route steps in both directions, with independent completion totals.
- JSON progress export/import and confirmed reset.
- Transfer progress using a QR code or link, without a server or account.
- Responsive layout, keyboard navigation and reduced-motion support.
- Static hosting with no backend, account, analytics or external fonts.

> **Spoilers:** this checklist reveals story events, items and puzzle solutions. The game has no NG+ or chapter select. Follow the warnings before advancing the story.

## Run locally

Install [Node.js](https://nodejs.org/) **22 or newer**, with npm.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173/`. Use the local server instead of double-clicking the HTML file: browsers restrict ES modules and JSON requests under `file://`.

```sh
npm test             # Filters, persistence, backups and guide data
npm run check        # Biome formatting and static analysis
npm run format       # Apply formatting
npm run build        # Copy the static website to dist/
npm run test:browser # Check browser interactions after building
```

Browser tests use the installed Microsoft Edge on Windows. On Linux/macOS, run `npx playwright install chromium` once. The workflow installs Chromium automatically and checks browser interactions before deploying.

To check repository-subpath hosting:

```sh
node scripts/serve.mjs --dist --subpath
```

Open `http://127.0.0.1:4173/hellisus-cheatsheet/`. Asset URLs are relative, so the site works at a domain root or below a repository path.

## Deploy to GitHub Pages

1. Create a **public** GitHub repository and push this project to `main`. Suggested name: `hellisus-cheatsheet`.
2. Under **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**.
3. Wait for **Check and deploy to GitHub Pages** under **Actions**. It installs dependencies, checks code and data, builds, then deploys. You can rerun it with **Run workflow**.
4. Find the live URL under **Settings → Pages** or the **github-pages** environment. For `alexsuslin/hellisus-cheatsheet`, the expected address is `https://alexsuslin.github.io/hellisus-cheatsheet/`.

See [`.github/workflows/pages.yml`](./.github/workflows/pages.yml). Pull requests run checks; only `main` deploys. Later pushes to `main` publish automatically.

If using another account or repository name, change the **GitHub** link in [`index.html`](./index.html). The workflow itself has no hardcoded repository name. Optional GitHub CLI setup:

```sh
gh auth login
gh repo create hellisus-cheatsheet --public --source=. --remote=origin --push
gh api --method POST repos/OWNER/hellisus-cheatsheet/pages -f build_type=workflow
gh workflow run pages.yml
```

`--push` requires at least one commit. Replace `OWNER` with your username. Skip the Pages creation command if Pages is already enabled.

## Progress

Each published build automatically versions CSS, JavaScript and JSON URLs. A normal page reload loads the new release on mobile without clearing browser data. The storage key and route/achievement IDs remain unchanged, preserving saved progress.

Checkboxes, language and theme live in the browser's `localStorage` at the current site address. Nothing is sent to a server or automatically synced between devices. Switching language or theme preserves all checkboxes.

Use **Export progress** before clearing browser data. To move progress, open the site on another device and choose **Import progress**. Import replaces checked steps after confirmation; corrupt or unrelated backups are rejected. If the browser blocks persistence, a warning appears and the checklist keeps working within the current tab.

For a quicker switch between desktop and mobile, choose **Transfer to another device**. Scan the QR code or copy the link; supported devices also offer **Share**. On the receiving device, review the saved check count and current step, then select **Apply progress**. This replaces route, achievement, build and tip checks and restores the selected step, language and theme. Checks are replaced, not merged. If a current step was selected, **Current** opens after import.

Each link is a snapshot: generate a new one after making changes. Progress is encoded after `#`, which is not sent to GitHub when loading the page; QR generation runs locally. Anyone with the link can open the save. The transfer is removed from the address bar after processing so reloading cannot reapply it. Damaged links leave progress untouched. If clipboard access fails, select and copy the link manually. JSON export remains available for backup files.

Version-2 links use hexadecimal encoding without Telegram formatting characters. Version-1 links are no longer supported: reload the site on both devices and generate a new link. Saved progress and JSON backups are unchanged.

For maintainers: positions in [`assets/transfer-catalog.js`](./assets/transfer-catalog.js) are the permanent version-2 link contract. **Append new IDs only**; never delete or reorder existing entries. Tests cover all progress IDs and lock the original positions. Retired IDs are filtered on import; unknown new positions require a site update. The QR generator ships locally under the [MIT license](./assets/vendor/LICENSE).

**The counter tracks route steps, not unique collectibles.** A good deed or mystery can require multiple actions in different locations. One action can grant several rewards and appear under several category filters. Check it off only after completing the described action.

In **Achievements**, select Steam / Xbox / Epic (40) or PS5 (41 including platinum). Check **Unlocked in game** after the actual unlock; the site does not synchronize with gaming accounts. **Related route steps** expands the linked actions and their progress. Selecting an action opens its location and clears obstructing filters. The **Achievements** button on a route step shows its linked trophies. Related-step totals do not count unique collectibles or kills. Both trackers share the same backup, and older route-only backups remain compatible.

## Data and translation

The **My build** tab tracks 22 workbook milestones for rage axes and a grief polearm. Acquisition and application record upgrade history, not current equipment slots. Audited `obtainRouteIds` pickup sets confirm acquisition when checked; equipment changes stay manual. Acquisition never completes a route step with extra pickups, and undoing a route step keeps acquired items. Pending application takes priority in the next-upgrade list. Optional build steps may be skipped without completing their route actions.

**Current** brings a selected route step, its build upgrades, Tips and achievements onto one screen. Select a location and step, use Previous / Next, or return to the first incomplete step. Checking an action keeps the current step in place. All views edit the same completion IDs; loop closure is the route checkbox. Acquired upgrades awaiting application remain visible after moving on. General reminders are under an expandable section. The selected step is saved and included as the optional `currentItemId` field in backups; old backups still work. Automatic acquisition runs when a pickup step is checked, without changing historical saves during loading or import.

**Tips** covers all 14 timeloops, farming reserves, useful rewards and story deadlines. Loop checkboxes share the existing route-step IDs and do not imply that all enemies are dead. Advice accounts for tier III farming and the detector upgrade in game version 1.7.

[`data/build.json`](./data/build.json) and [`data/tips.json`](./data/tips.json) own this content. [`data/terminology.json`](./data/terminology.json) records 46 RU/EN mappings and evidence: `community` means a Russian walkthrough match, while `unverified` displays †. No official localization-file verification is claimed. Reviewed October 13, 2026.

All checks use the existing localStorage key and version-1 backup format. Old backups remain supported; importing one replaces all checks, including build and tip progress absent from that backup.

[`data/guide.json`](./data/guide.json) owns the route. Sections and steps have permanent IDs, `ru`/`en` translations, categories and detailed source links. Edit wording without changing the `id` to preserve saved progress. A new action needs a new ID; never reuse an old ID for a different action.

[`assets/i18n.js`](./assets/i18n.js) contains interface translations. Some item names remain in English to help match the original guide; Russian wording is not presented as the game's official localisation.

[`data/achievements.json`](./data/achievements.json) owns achievement requirements, hints, warnings, trophy tiers and route links. Links use explicit `route.itemIds` or `route.categories`. The six research topics link to their matching objects and the Tania handover step. Achievement IDs begin with `achievement-` and must remain stable when editing wording. Russian achievement titles are convenience translations; original names are also displayed.

## Sources and credits

- [PowerPyx: Collectible Walkthrough](https://www.powerpyx.com/hell-is-us-collectible-walkthrough/) — game facts and chronological route: Act 1, all three Act 2 parts, Act 3 and cleanup.
- [PowerPyx: Missables Guide](https://www.powerpyx.com/hell-is-us-missables-guide/) — time-sensitive actions and their order.
- [Steam achievements](https://steamcommunity.com/stats/1620730/achievements/), [Epic Games achievements](https://store.epicgames.com/achievements/hell-is-us-b9c06d?lang=en-US) and [PowerPyx: Trophy Guide](https://www.powerpyx.com/hell-is-us-trophy-guide-roadmap/) — the complete list, requirements and missable warnings.
- [GameShelter's Russian walkthrough](https://gameshelter.space/blog/hell-is-us-letopis-prokhozhdeniya-blagie-dela-kepki-i-razgovory-s-nps) — Russian location names and terminology.
- [Dark Souls 3 Cheat Sheet](https://zkjellberg.github.io/dark-souls-3-cheat-sheet/) — inspiration for the interactive checklist format.

Directions are concise original summaries. Each step links to the original illustrated guide; third-party articles and screenshots are not redistributed with the site. An independent fan project, unaffiliated with **Rogue Factor**, **Nacon**, PowerPyx or GameShelter.

Source code and original wording are available under [MIT](./LICENSE). Game, item and character names belong to their respective owners.
