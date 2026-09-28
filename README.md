# PaperFlow

**Research Readiness Workspace**  
From vague research topics to citation-backed evidence.

PaperFlow connects **Topic → Sources → Evidence → Claims** in a persistent, private research project. This repository was created from scratch at `C:\PaperFlow`; no earlier repository, Matrix Builder, or data was reused.

## What you can do

1. Create an account and research project. Describe a topic, team, timeline, data, and constraints; analyze six readiness dimensions; edit/refine and confirm a direction.
2. Upload PDFs. Page-aware text extraction is persisted once. Evaluate source-derived facts separately from AI interpretations of relevance, usefulness, recency, and limitations.
3. Explore an evidence matrix, filter by source/type/text, export CSV, and compare sources. Open any item to inspect its verified quotation, full extracted page, and original PDF.
4. Paste an academic draft or upload PDF/TXT/Markdown. Extract claims, inspect support/counterevidence, citation issues, limitations, and recommended evidence-related actions. Reopen projects with results intact.
5. Optionally publish a practical topic note in the shared Topic Experience Hub. Private project content is never automatically published.

PaperFlow is not a writing generator or an assurance of academic correctness. No sample research is inserted in the production database.

## Architecture

```text
FE/src                     React 19 + TypeScript, React Router, Vite
BE/app/api.py              Presentation: HTTP, DTO validation, session boundary
BE/app/application/        Business: workflow, grounding, invalidation, contracts
BE/app/infrastructure/     SQLite repositories/migrations, PDF/files, Gemini
BE/app/main.py             Composition and configuration
```

Presentation calls application services. Services depend on `Repository`, `AiProvider`, `PdfExtractor`, and `FileStorage` protocols. Infrastructure implements those ports. The frontend has no AI key or database access.

`AiProvider` defines typed topic analysis, source evaluation, evidence extraction, claim extraction, claim checking, and comparison operations. Gemini uses server-side GenerateContent JSON-schema output; the optional local Ollama adapter uses Ollama's JSON-schema chat output. Both are validated with Pydantic before PaperFlow saves a result. See [Google's structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

## Local setup (Windows PowerShell)

Prerequisites: Python 3.11+, Node.js 24+, npm. No external database is required. Run from `C:\PaperFlow`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r BE\requirements.lock.txt
Set-Location FE
npm.cmd ci
Set-Location ..
Copy-Item BE\.env.example BE\.env
```

Set your own `GEMINI_API_KEY` in `BE/.env`. Without it, accounts, projects, uploads, extraction, draft saving, and the hub work; AI requests return an actionable configuration error. There is no fake fallback. Set `GEMINI_MODEL` to a GenerateContent model available to your Google project that supports JSON-schema output (default `gemini-3.1-flash-lite`). Model/account availability must be verified with your own credentials.

Backend, in one terminal:

```powershell
Set-Location C:\PaperFlow\BE
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend, in another:

```powershell
Set-Location C:\PaperFlow\FE
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Vite proxies `/api` to the backend; all frontend requests use relative URLs. Alternatively, `./scripts/start.ps1` launches hidden local server processes and writes logs under FE/BE. Stop those server processes when finished. API docs: http://127.0.0.1:8000/api/docs in development only.

## Temporary local Ollama trial

With [Ollama](https://ollama.com/) installed and the `qwen2.5:3b` model pulled, run this from `C:\PaperFlow`:

```powershell
ollama pull qwen2.5:3b
.\scripts\run_ollama_local.ps1
```

This starts PaperFlow at **http://localhost:8080** with `AI_PROVIDER=ollama`; it stops only the Docker frontend to free port 8080 and does not rebuild Docker images. Its database is isolated in `artifacts\ollama-local-data`, so create a new account for the trial. Run `.\scripts\stop_ollama_local.ps1` to stop the temporary servers and restore the Docker frontend.

## Configuration

| Variable | Meaning |
|---|---|
| `GEMINI_API_KEY` | Server-only Gemini credential; never commit it |
| `GEMINI_MODEL` | JSON-schema-capable GenerateContent model |
| `AI_PROVIDER` | `gemini` (default) or `ollama` |
| `OLLAMA_MODEL` | Local Ollama model, default `qwen2.5:3b` |
| `OLLAMA_URL` | Local Ollama API base URL, default `http://127.0.0.1:11434` |
| `DATA_DIR` | Persistent database and upload directory; defaults to `BE/data` |
| `ENVIRONMENT` | `development` or `production` |
| `SECURE_COOKIES` | Must be `true` in production; requires HTTPS |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins authorized for writes |
| `ALLOWED_HOSTS` | Comma-separated API hostnames; include `127.0.0.1` for container health checks |

Development `.env` is read from the backend working directory. Docker Compose reads root `.env`. No frontend secret or production localhost URL is embedded in the bundle. Fonts use Google Fonts with local sans-serif fallbacks.

## Data and workflow integrity

SQLite uses WAL, foreign keys, transactional saves, optimistic project versions, and project-level durable operation leases. Relational tables hold users, hashed expiring sessions, projects, sources, pages, evidence, drafts, claims, evidence matches, comparisons, and hub notes. Typed JSON payloads hold evolving analysis fields; identities and provenance relations have database foreign keys. Indexes cover ownership, sessions, and child-record lookups. Migrations `001_initial.sql` and `002_query_indexes.sql` run once automatically at startup; migration versions are recorded. Back up before adding future migrations; never rewrite an applied migration.

Password hashes use salted scrypt. Session tokens are random, hashed at rest, expire after seven days, and use HttpOnly/SameSite cookies. Every project and source access verifies ownership. Writes reject unexpected browser origins. Login attempts are bounded in-process; use edge rate limiting for public deployments. Do not expose the backend directly to the public network. User filenames never become filesystem paths. Generated source IDs address original files.

Quotes must match whitespace-normalized extracted text on the referenced page. Evidence content must be an extract from its quote; ungrounded paraphrases fall back to the verified quotation (or are rejected if too long). Unknown metadata is omitted and labeled unknown in the UI. Facts must be quoted and their values present in the quote. AI-created references to unavailable evidence are rejected. Quotations are mechanically verified; evaluations, comparisons, and claim entailment still require human review. Mixed support is conservatively represented as partial support. Absence of support is not proof that a claim is false.

Topic edits remove confirmation, analysis, source evaluations, comparisons, and claim checks; page extraction and source-grounded evidence remain. Adding/removing/re-extracting source evidence resets draft checks and comparisons. Draft edits reset that draft's claims. Successful results are reused on repeated API calls unless explicitly regenerated. Failed source or draft operations preserve completed work and expose retry states. Concurrent operations on a project return 409; a process interrupted by a crash leaves a lease that expires after 30 minutes. Normal AI workflows are bounded below that lease duration. This deliberately uses a single backend process rather than a distributed job system.

## Deliberate limits

- 30 sources and 20 drafts per project. PDFs: 20 MB, 150 pages, 240,000 extracted characters. Larger sources should be split. Encrypted PDFs and textless scans need unlocking/OCR before upload. Figures, tables with unreliable extraction, and scanned pages are not silently interpreted.
- Source evaluation uses the first 80,000 characters by complete page, with a visible coverage warning if truncated. Evidence extraction processes all accepted pages in bounded batches.
- Comparisons inspect at most 80 items, sampled across selected sources. Saved comparisons are labeled separately from current matrix filters.
- Drafts: 60,000 characters and up to 40 extracted claims. Each claim uses up to 40 persisted evidence items chosen by lexical overlap; reports explicitly disclose the selection and coverage limit. This can miss differently worded relevant evidence. There is no bibliographic database validation or external literature search.
- Gemini calls time out after 90 seconds. Transient server/rate-limit failures retry once. Draft processing pauses at its time budget and can resume saved claim results.
- This deployable baseline targets individual/small-group usage. SQLite aggregate persistence is intentionally simple; high-volume multi-instance operation requires a database/worker architecture review.

## Validation

Backend, from `BE`:

```powershell
..\.venv\Scripts\python.exe -m compileall -q app
..\.venv\Scripts\python.exe -m ruff check app tests
..\.venv\Scripts\python.exe -m pytest -q
```

Frontend, from `FE`:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

The browser test uses an isolated fixture server and test-only AI provider, never production credentials. Stop local servers on ports 8000/5173 before running it. Its database and screenshots live under root `artifacts/`. `artifacts/test-source.pdf` is generated by the fixture script below and contains synthetic test text only:

```powershell
Set-Location C:\PaperFlow\BE
..\.venv\Scripts\python.exe -m tests.prepare_e2e
```

Tests cover the four-module workflow, PDF extraction, persistence, duplicate requests, ownership, invalidation, malformed/failed AI responses, all support states, and migration/foreign-key integrity. CI uses the same tests. No automated test calls live Gemini.

An explicitly authorized live audit uses the running Docker deployment and consumes Gemini quota. From `BE`, run `..\.venv\Scripts\python.exe verification/prepare.py`, then `..\.venv\Scripts\python.exe verification/live.py <unique-run-name>`. These original synthetic PDFs are test inputs only; all results come through the real application/provider. Run `verification/audit.py <unique-run-name>` for provenance/ownership checks, then from `FE` run `node verification/browser.mjs <unique-run-name>` for deployed UI and CSV checks. Repeat the audit after a normal container restart to compare persisted snapshots. Local reports, screenshots, and verification-account credentials stay in ignored `artifacts/live`; do not publish the account state files. The live script checks the five expected claim categories, while human review must still assess explanation quality.

## Production build and deployment

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose config --quiet
docker compose up --build -d
```

Local Docker serves the site at http://localhost:8080. The backend is internal; the frontend proxies API requests. Named volume `paperflow-data` persists both SQLite and PDF files. Do not use `docker compose down -v` unless intentionally deleting all data. `/api/health` is the application liveness endpoint and reports whether an AI key is configured, not whether Google has validated it.

For an internet deployment, configure an HTTPS reverse proxy on the host in front of `127.0.0.1:8080`, set `ENVIRONMENT=production`, `SECURE_COOKIES=true`, `ALLOWED_ORIGINS=https://your-domain`, and `ALLOWED_HOSTS=your-domain,127.0.0.1`. Keep the backend private. Configure body/time limits and request rate limits at the edge. Inject secrets from your hosting platform. Build uses locked npm/Python dependencies. Review dependency updates before upgrading. Container health checks and restart policies are included.

Back up the **whole** data volume while the backend is stopped (database and PDFs must be consistent), or use SQLite's backup API plus coordinated file snapshots. Test restore before relying on a backup. For a running database, never copy only the `.db` and ignore WAL files. Deployment is not claimed until images are built, started, and tested on the target platform with its own credentials.

See [AGENTS.md](AGENTS.md) for persistent engineering rules and [VALIDATION.md](VALIDATION.md) for the validation actually performed during implementation.
