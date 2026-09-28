# PaperFlow deployment

## Prerequisites

Docker Engine/Desktop with Compose, a persistent storage volume, outbound HTTPS access to the Gemini API, and an API key authorized for a JSON-schema-capable Gemini model. For internet access, configure a domain and an HTTPS reverse proxy on the host. The frontend listens on loopback port 8080; the backend remains on the private Compose network.

## Configuration and secrets

Copy root `.env.example` to root `.env` **only if `.env` does not already exist**. Preserve existing user credentials. Set the real `GEMINI_API_KEY` in that ignored file or inject it from the deployment platform. Never put credentials in Dockerfiles, build arguments, source, screenshots, logs, or example files. Both build contexts exclude `.env`; Compose injects secrets into the backend at runtime.

| Variable | Use |
|---|---|
| `GEMINI_API_KEY` | Required for AI operations; server only |
| `GEMINI_MODEL` | Choose a model actually accessible to the account; listing a model does not guarantee GenerateContent access |
| `ENVIRONMENT` | Use `production` for a public deployment |
| `SECURE_COOKIES` | `true` in production; the server rejects production startup otherwise |
| `ALLOWED_ORIGINS` | Exact comma-separated browser origins, e.g. `https://research.example.org` |
| `ALLOWED_HOSTS` | Hostnames without scheme/port, e.g. `research.example.org,127.0.0.1`; loopback is needed by container health checks |
| `DATA_DIR` | `/data` inside the container, explicitly set by Compose; local non-Docker default is `BE/data` |

Local HTTP uses `ENVIRONMENT=development`, `SECURE_COOKIES=false`, and `ALLOWED_ORIGINS=http://localhost:8080`. Do not copy those cookie settings into a public deployment. Browser requests use relative `/api` URLs and Nginx proxies them to the backend; a frontend AI key is neither required nor permitted.

The model name is deployment configuration. If Google returns model-unavailable errors, update `GEMINI_MODEL` and recreate the backend. Temporary 429/503 responses are not proof that the API key is invalid. Live-provider availability is separate from application health.

## Build and start

From `C:\PaperFlow`:

```powershell
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

Use `config --quiet`; plain `docker compose config` can print expanded secrets. After changing environment values, run `docker compose up -d --wait` to recreate the affected container. `docker compose restart` alone does not reload changed Compose environment configuration.

Verify locally at http://localhost:8080. `GET /api/health` should return `status: ok`. Its `ai_configured` boolean confirms only that a key is present. It does not verify account access, quota, or model availability.

```powershell
.\.venv\Scripts\python.exe scripts\smoke_deployment.py
```

This HTTP smoke does not spend Gemini tokens. For a public deployment, terminate TLS at the edge, proxy to `127.0.0.1:8080`, preserve the expected Host header, and configure upload limits, request limits, and sufficient timeouts for synchronous research processing. Do not publish the backend port.

## Database and uploaded files

The `paperflow-data` named volume mounts at `/data` and contains the SQLite database and `/data/uploads`. Container replacement or normal restart must retain this volume. Never run `docker compose down -v` unless intentionally deleting all project data.

Forward SQL migrations run automatically before application startup. Applied migration names are recorded in SQLite. The backend runs as a non-root user and uses WAL, foreign keys, and transactional saves. A failed migration must prevent startup rather than silently creating a fresh database elsewhere.

Back up the entire data volume while the backend is stopped, or use SQLite's backup API with coordinated upload-file snapshots. Copying a live `.db` without its WAL is not a reliable backup. Keep backups encrypted and access-controlled and test restoring both the database and PDFs.

## Operational checks

- Check backend health, frontend asset responses, and a real authenticated project read after deployment.
- Confirm both migrations and `PRAGMA foreign_key_check` after restoration/upgrades.
- Verify a saved source can still download after `docker compose restart backend frontend`.
- Observe safe AI task/model/status logs; do not enable HTTP header/body logging.
- A project interrupted during processing may retain its operation lease until the 30-minute expiry. Inspect the saved failure/partial state before retrying; do not manually insert successful analysis results.
- Run one backend worker. Multi-instance deployments need a separate concurrency/storage review.

See `VALIDATION.md` for executed verification results, including any remaining external provider limitations. Public hosting and TLS deployment are not implied by successful local Docker startup.
