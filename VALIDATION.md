# Live integration audit — 2026-09-24

Environment: `C:\PaperFlow`, Windows, Python 3.11, Chromium, and Docker Desktop Linux containers. Existing user data was preserved.

## Current result

Two real Gemini workflows completed through the deployed application. The second produced 17 independently verified quotations from three original two-page synthetic PDFs. Semantic review identified defects, which were corrected and regression-tested. **Fresh live verification of the final repair batch remains incomplete:** Gemini returned HTTP 503 during topic analysis on both `gemini-3.1-flash-lite` and `gemini-3.6-flash`. Each application request retried once. No fake outputs or database patches were substituted. This external blocker prevents unconditional final live sign-off.

The runtime model is restored to `gemini-3.1-flash-lite`, which completed the second workflow. The initial `gemini-2.5-flash` configuration was unavailable for this account despite appearing in its model list. Health confirms configuration presence, not model access or service availability.

## Executed live workflows

`first-live` completed project creation, topic analysis/confirmation, three PDF uploads, evaluation, 16 grounded evidence items, comparisons, a saved draft, five claim checks, UI/CSV audits, ownership checks, and an identical persisted snapshot across restart. Its initial topic used `gemini-3.6-flash`; later processing used `gemini-3.1-flash-lite`.

`final-live` used `gemini-3.1-flash-lite` throughout, including topic refinement and reanalysis before confirmation. All sources completed; 17 quotations were checked against independently extracted original pages. Five meaningful claims were copied verbatim; nonfactual closing prose was omitted. Missing authors, year, publication, and DOI remained absent. Every claim evidence ID resolved to an owned source/page.

| Controlled claim | Actual second live result | Review |
|---|---|---|
| Supervised feedback improved immediate scores by 12 points | Supported | Matches source A |
| Benefits apply to every student | Partially supported | Correct label; old explanation retained a conflicting conclusion |
| Unsupervised copying improved delayed retention | Contradicted | Source C reports eight points lower retention |
| Study A concluded teaching costs fell 40% | Insufficient evidence | Should be unsupported attribution under product rules |
| Guided feedback improves post-graduation employment | Insufficient evidence | Outcome not studied |

Historical results remain unchanged in ignored artifacts. `verified-live` is the fresh final-code attempt; its report records the provider blocker. The live runner now asserts all five expected categories after saving the genuine response. The final attribution-priority, explanation, and extractive-content changes await a successful fresh live run.

## Fixes implemented

- Compact provider JSON schemas to avoid rejected generation grammars while retaining full local Pydantic validation.
- Actionable, secret-free model/authentication/unavailability errors; log task/model/status only.
- Resume extraction without repeating successful evaluation; idempotent topic confirmation; explicit reprocessing of completed empty results.
- Distinguish contextual evidence of unmeasured outcomes from support/counterevidence. Reject inconsistent unsupported/insufficient relationships. Prioritize unsupported named-source attributions.
- When relationships normalize a status, construct its explanation from those relationships instead of retaining the conflicting provider conclusion.
- Require evidence content to occur in its grounded quotation. Non-extractive paraphrases fall back to the quote, or are rejected if too long, preventing added statistical or temporal interpretations in evidence records. Evaluations/comparisons/claim entailment still require review.
- Add regression coverage, opt-in live API/browser audits, database/secret audits, and deployment documentation.

## Final automated validation

These commands ran on the final repair batch. Provider tests use mocks; the browser regression uses a separate database and test-only provider. They do not establish live service availability.

| Check | Command | Executed result |
|---|---|---|
| Python compilation (BE) | `..\.venv\Scripts\python.exe -m compileall -q app` | Passed |
| Ruff (BE) | `..\.venv\Scripts\python.exe -m ruff check app tests verification ../scripts` | Passed |
| Python formatting (BE) | `..\.venv\Scripts\python.exe -m ruff format --check app tests verification` | 20 files clean |
| Backend tests (BE) | `..\.venv\Scripts\python.exe -m pytest -q` | **42 passed** |
| Python dependencies (BE) | `..\.venv\Scripts\python.exe -m pip check` | No broken requirements |
| TypeScript/ESLint (FE) | `npm.cmd run typecheck`, `npm.cmd run lint` | Passed |
| Formatting (FE) | `npm.cmd run format:check`, `npx.cmd prettier --check verification` | Passed |
| Production build (FE) | `npm.cmd run build` | Passed |
| Browser regression (FE) | `npm.cmd run test:e2e` | **1 comprehensive scenario passed** |
| Production dependency audit (FE) | `npm.cmd audit --omit=dev` | 0 vulnerabilities reported |
| Docker build/start (root) | `docker compose up --build -d --wait` | Images built; backend healthy; frontend running |

Coverage includes malformed/refused AI output, timeouts/provider errors, grounding, support states, context-only matches, inconsistent status rejection, caching/resume, invalidation, ownership, sessions/origins, versions/leases, and clean-database migration replay. One non-failing Starlette/httpx deprecation warning remains.

## Deployed audits

`verification/audit.py final-live` and `node verification/browser.mjs final-live` passed against real Docker services without mocked routes. They verified original PDF bytes/pages, all 17 quotations, source facts, claim references, CSV provenance, saved-state reopening, dialogs, navigation, and 390-pixel mobile layout. Major screens were captured and visually reviewed. No JavaScript exceptions or unsolicited AI calls occurred. Repeated completed API operations made zero additional Gemini calls and left the version unchanged. A second account was denied project, source file/page, processing, comparisons, and draft checks; its UI showed Project not found.

The database audit found both migrations, `integrity_check=ok`, no foreign-key violations, coherent authoritative versions, and zero operation locks after provider failures. Docker persists SQLite and PDFs in `/data`; restart snapshot comparisons verify retained data.

The exact-key scan walks the entire project tree, including ignored dependencies/artifacts and built assets. It found the key only in ignored root `.env`, with zero tracked occurrences and no unreadable files. Image configuration/history and container logs are inspected without printing their contents. Docker build contexts exclude secrets; the backend receives the key at runtime. No commit was created; implementation files remain untracked in this new repository.

Reports/screenshots live in ignored `artifacts/live`. Account state files contain local verification passwords and must not be published. Provider credentials are absent from those reports.

## Remaining blocker and resume

When Gemini recovers, resume from BE with `..\.venv\Scripts\python.exe verification/live.py verified-live`, then run that project's API/browser audit, restart snapshot comparison, and final validation. Do not claim final semantic sign-off until that fresh path completes and its explanations are reviewed.

The local Docker app is at http://localhost:8080. Public hosting/TLS deployment was not performed; no target was supplied. See `DEPLOYMENT.md` for settings, persistence, backups, and operating limits.

---

# Historical implementation validation (before the supplied Gemini key)

The section below records the original implementation baseline only. Its test counts and missing-key status are superseded by the live audit above.

Validated locally on 2026-09-24. The repository was created at `C:\PaperFlow` without reading or reusing the previous PaperFlow repository.

## Final results

| Check | Actual command | Result |
|---|---|---|
| Python compile | `..\.venv\Scripts\python.exe -m compileall -q app` from BE | Passed |
| Backend lint | `..\.venv\Scripts\python.exe -m ruff check app tests` from BE | Passed |
| Backend tests | `..\.venv\Scripts\python.exe -m pytest -q` from BE | **36 passed** |
| Python dependency consistency | `..\.venv\Scripts\python.exe -m pip check` from BE | No broken requirements |
| Frontend TypeScript | `npm.cmd run typecheck` from FE | Passed |
| Frontend lint | `npm.cmd run lint` from FE | Passed |
| Frontend format | `npm.cmd run format:check` from FE | Passed |
| Frontend production build | `npm.cmd run build` from FE | Passed; Vite emitted deployable assets |
| Browser workflow | `npm.cmd run test:e2e` from FE | **1 comprehensive scenario passed** |
| Frontend production dependency audit | `npm.cmd audit --omit=dev` from FE | 0 vulnerabilities reported |
| Compose configuration | `docker compose config --quiet` | Passed |
| Container images and local startup | `docker compose up --build -d --wait` | Both images built; backend healthy; frontend running |
| Deployed HTTP smoke | `.\.venv\Scripts\python.exe scripts\smoke_deployment.py` | Passed |
| Container database migrations | Queried `/data/paperflow.db` through `docker compose exec -T backend python` | `001_initial.sql` and `002_query_indexes.sql` present |
| Container database integrity | `PRAGMA foreign_key_check` | Empty result: no violations |

The HTTP smoke checked the deployed HTML, built asset responses, deep SPA routes, CSP/security headers, unauthenticated API rejection, invalid login rejection, and cross-origin write rejection. It did not call Gemini or insert demo research into the deployed application.

## Test coverage

Backend tests cover project creation/retrieval/deletion, persisted topic analysis and confirmation, topic invalidation, PDF extraction and failed/scanned PDFs, duplicate uploads, grounded metadata/evidence rejection, original file/page access, comparisons, saved drafts, all five claim-support states, mixed evidence, invalid evidence IDs, retries, draft editing, cross-user isolation, sign-out, origin checks, operation leases, optimistic versions, forward migration replay, foreign keys, hub notes, missing API configuration, production cookie enforcement, malformed/refused AI responses, timeouts, provider errors, and bounded rate-limit retries.

The browser scenario uses an isolated **test-only fake AI provider**, a synthetic one-page PDF, and a separate database under `artifacts/`. It exercises account registration → project creation → topic analysis → confirmation → upload → source processing → evidence provenance → draft save → claim check → evidence review → refresh/persistence → mobile navigation. Browser JavaScript exceptions and horizontal overflow are checked. Production composition never imports this fixture provider.

Screenshots were visually reviewed:

- `artifacts/dashboard-desktop.png`
- `artifacts/claim-provenance.png`
- `artifacts/essay-mobile.png`

These images contain synthetic test data, not outputs from live Gemini.

## Batch fixes made during validation

The first pass found a JSX closing brace and a Python protocol annotation shadowing `list`. Subsequent collected findings included a redundant regex escape, unused imports after splitting frontend modules, an ambiguous browser assertion, and a mobile navigation visibility issue. Those were corrected in batches. Provider validation was strengthened for malformed response shapes. Final checks above passed after the corresponding changes.

Non-failing tooling notices: Starlette's test client reports an `httpx` integration deprecation; npm reports ESLint 9's upstream end-of-support notice. Neither prevents the checks or application from running. Dependency lockfiles record the tested versions; npm's production audit reported no vulnerabilities.

## Running deployment and external dependencies

**Local Docker deployment:** http://localhost:8080. The port is bound to loopback. Production frontend assets are served through Nginx. This local deployment uses development cookie settings for HTTP; an internet deployment must use the HTTPS/environment configuration in README.

**Gemini:** The deployed health response reports `ai_configured: false`. No user-owned Gemini key was available, so no live provider call was performed. Automated tests verify the provider contract with mocked HTTP and fake application adapters. To enable real AI, copy root `.env.example` to `.env`, set `GEMINI_API_KEY` and an available `GEMINI_MODEL`, then run `docker compose up -d` to apply the environment.

**Public deployment:** Not performed; no target domain, hosting credentials, or TLS configuration was supplied. Container builds and local deployment were actually performed and verified.

For OCR, retrieval limits, upload limits, and semantic evidence-review limitations, see README. There are no known failing local checks from the validation commands listed above.
