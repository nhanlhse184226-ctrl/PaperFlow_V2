# PaperFlow UI/UX direction

Applied UI UX Pro Max v2.13.0 from the user's local repository on 2026-09-28.
Installed skill: C:/Users/Admin/.codex/skills/ui-ux-pro-max/SKILL.md

## Decisions

- Product: private academic research workspace, React 19, English/Vietnamese.
- Retain PaperFlow's forest-green identity, DM Sans/Manrope, and four connected modules.
- Use a calm light canvas, white surfaces, clear borders, rounded panels and restrained elevation.
- Main text #213b30, secondary text #56675e, primary action #195c49 with white text.
- Body/form content 14–16px, comfortable 1.6–1.8 line height. AI explanations 15px.
- Interactive controls at least 44px high; visible focus and semantic HTML.
- Language selector belongs in the header, not over scrolling analysis content.
- Topic analysis uses separate dimension cards with text labels as well as status colors.
- Collapse the topic's two-column layout at 1200px; wrap project tabs on narrow screens.
- Mobile navigation has a dismissal backdrop and Escape support. Respect reduced motion.

## Skill research

The first academic query suggested an irrelevant portfolio layout; it was rejected.
The narrower productivity SaaS query returned Flat Design: suitable for the app's restrained
interaction style, clear hierarchy and fast rendering. Marketing/demo sections were rejected
because this product is an authenticated workspace. Existing brand typography and forest
colors were retained. React `accessible` guidance recommends role/label-based verification.

## Rollback

Full pre-change working snapshot (including local configuration/artifacts, excluding
node_modules, .venv, .git, Python caches):
`C:/PaperFlow-backups/before-uiux-20260928-150236`.
31 FE/src and BE/app source files verified by SHA-256 before UI edits.
Do not publish that backup: it includes local configuration.

Run `scripts/restore-before-uiux.ps1`, then `docker compose up -d --build`.
The restore preserves current source in a separate timestamped directory first.
No database reset or Docker volume deletion is performed.
