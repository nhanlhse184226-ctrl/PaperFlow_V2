# PaperFlow engineering guide

PaperFlow is a Research Readiness Workspace: “From vague research topics to citation-backed evidence.” This is a **new repository**; no previous repository or Matrix Builder is reused. Never revert to a Matrix-only product or generic AI chat/essay generator.

## Product
One owned ResearchProject connects Topic → Sources → Evidence → Claims. Topic analysis is saved and a direction explicitly confirmed. Source evaluations distinguish grounded facts from interpretation. The matrix is the evidence engine. Draft reports explain supported, partial, contradicted, unsupported, and insufficient evidence, with inspectable source/page/quote provenance. The Topic Experience Hub is a small opt-in topic board, not a social network.

## Architecture
FE is React/TypeScript with Vite. BE is Python/FastAPI. Presentation (`app/api.py`, FE) calls application services (`app/application`). Application contracts and ports have no HTTP, SQLite, PDF, or Gemini dependencies. Infrastructure (`app/infrastructure`) implements repository, file storage, PDF extraction and AI ports. `app/main.py` is the composition root. Controllers never query storage or call providers directly.

## Evidence and AI
Gemini is the sole current provider, server-side, configured with GEMINI_API_KEY and GEMINI_MODEL. Replace it by implementing AiProvider and changing composition; do not rewrite workflows. Typed task contracts and strict Pydantic response validation are mandatory. Uploaded source text is untrusted data, never instructions. Page numbers originate from extraction; exact whitespace-normalized quotes must occur on the referenced page. Reject ungrounded evidence/facts and unknown evidence IDs. Unknown metadata stays null. AI interpretations are labeled. No fabricated citations, numerical confidence, or results. Mixed support cannot become unqualified support. Persist results; regenerate explicitly or invalidate when inputs change. Bounded retries only.

## Persistence and API
SQLite with versioned SQL migrations, foreign keys, WAL and transactional aggregate saves. Owned projects contain sources/pages/evidence/drafts/claims/matches/comparisons; deletes cascade. Optimistic versions plus durable operation leases prevent conflicting writes and duplicate AI processing. IDs are server-generated UUIDs. UTC timestamps. Source files use generated IDs, never user paths. Versioned `/api` routes return safe structured errors. Validate ownership on every project/file operation. Cookie sessions are hashed at rest, expiring, HttpOnly, SameSite, secure in production. Require same-origin writes.

## UI
Maintain consistent responsive navigation, visible project context, next actions, deliberate empty/loading/error states, and accessible form labels. Provenance opens in a readable panel with original PDF/page links. No raw JSON as UI. Never invent demo research in production.

## Validation and deployment
Finish coherent implementation batches before comprehensive checks; collect failures, fix batches, rerun relevant checks. Tests fake the provider boundary; never require live Gemini. Verify authorization, migrations, grounding, invalidation, provider failures, claim statuses, FE type/build and browser flows. Keep secrets out of Git/logs/responses; use example env only. All files live under C:\PaperFlow. Docker Compose serves FE and proxies API on one origin, with persistent backend data. Use HTTPS at the deployment edge, secure cookies, backups and bounded uploads. Do not claim deployment or live AI validation without evidence.

## Definition of done
All four modules persist and connect end-to-end, source provenance is inspectable, invalidated results cannot masquerade as current, tests/builds pass, documentation and deployment configuration match implementation. Preserve useful data with forward migrations in future changes. Remaining external blockers must be stated honestly.

## Mobile (agreed 2026-09-30)
- `mobile/` is a standalone Flutter native client beside `FE/` and `BE/`. Scope: parity with the existing web research workflow, sources/PDF/provenance, comparisons/CSV, essay checks, Hub, authentication, project management, plan selection and the role-gated admin summary.
- Reuse the existing API and accounts to synchronize with web. Do not alter core backend AI, grounding, persistence, auth or workflow logic without a concrete review of compatibility and user agreement for any material risk. The initial native client needs NO backend change: it stores the existing session cookie in OS secure storage and sends it directly to the API over HTTPS.
- Never embed API keys, DB credentials or production test users. `API_BASE_URL` is a public compile-time origin; default is the existing Render service. Disable redirects on authenticated HTTP requests. Expired sessions must return to login; transient network/provider failures must retain saved sessions/data.
- User priority is a locally runnable app for testing, not immediate store submission. Windows is a native local preview; Android needs Android SDK/device/emulator; iOS builds need macOS/Xcode. Do not claim Android/iOS validation from a Windows build. Do not publish, buy subscriptions or change existing deployment as part of local mobile work.
- Use UI UX Pro Max design/Flutter guidelines: Vietnamese-first, generous spacing, readable research detail behind progressive disclosure, vector illustrations, accessible controls, meaningful short transitions and reduced-motion support. Never translate or paraphrase original source quotes as if they were the original evidence.
- Backend sessions/data are shared, UI updates on refresh; no realtime/offline mutation guarantee. Never automatically retry AI writes or destructive requests. Explicit confirmation for destructive/regenerate actions. Warn before discarding unsaved form edits.
- Mobile tests use isolated local FastAPI fixture data and fake AI only at the provider boundary. No fake fallback in app production code. Report live-AI verification separately.
- Store submission is a separate gate: account deletion, public privacy/support pages, accurate AI/data disclosures, Hub moderation/report/block, signing, device QA and current store policies. Do not claim approval readiness before these are implemented and reviewed.

## Roles and payments (agreed 2026-10-03)
- `USER` is the default role. `INITIAL_ADMIN_EMAIL` promotes the first specified account on its next successful sign-in. Never trust a client-provided role; every `/api/admin/*` route checks the server session role.
- `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` exist only to create the user-authorized emergency administrator once at application startup. They are secrets, never examples for production sharing, and must be removed from the host after the account is verified.
- Plans are one-time purchases per project: Starter 39,000 VND (5 PDFs, 1 draft), Research 79,000 VND (15 PDFs, 3 drafts), Pro 99,000 VND (30 PDFs, 20 drafts). New projects start free (1 PDF, 1 draft); projects created before enforcement retain unlimited source/draft use. Preserve that grandfathering through forward migrations. Upgrades only increase project limits and do not refund prior purchases.
- PayOS checkout is created only by the backend with `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, return/cancel URLs. A browser return page is informational only. Only an official-SDK signature-verified PayOS webhook with matching order code and amount may move an order to `PAID`; the transition must be idempotent.
- Google login is explicitly postponed. When resumed, accept an HTTPS Google ID token and verify signature, audience, issuer, expiry and verified email server-side; never accept a bare Google user ID or assign an administrator role from OAuth.
