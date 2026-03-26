# Musician Genealogy Project

Web app for exploring pedagogical genealogies of musicians — who studied with whom, where, and when. Launching with oboe, designed for any instrument. Now includes pianist data (Morozova lineage back to Beethoven).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, Python 3.12+ |
| Database | SQLite (local dev), PostgreSQL (production via Railway) |
| Frontend | React (Vite), Tailwind CSS v4 (@tailwindcss/vite plugin), React Router |
| Search | unidecode for diacritical normalization; pg_trgm for fuzzy matching (Postgres only) |
| Tree Viz | D3.js (d3.hierarchy + d3.tree, bidirectional layout) |
| AI | Anthropic Claude API (Haiku for submission parsing) |
| Email | Resend (async SDK) for transactional emails |

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app, CORS, router registration, lifespan (startup purge)
    models.py        # All SQLAlchemy models (12 tables)
    schemas.py       # Pydantic request/response schemas
    database.py      # Engine, session, Base
    auth.py          # Session cookie admin auth
    rate_limit.py    # IP-based rate limiting
    email_service.py # Resend integration: verification, approval, rejection emails
    seed_data.py     # Idempotent CSV loader (python -m app.seed_data)
    routers/         # auth, musicians, lineage, instruments, institutions, search, submissions, sources, parse_text
  alembic/           # Migrations (auto-generated from models)
  alembic.ini
  requirements.txt
frontend/
  src/
    main.jsx, App.jsx, api.js, index.css, constants.js
    pages/           # HomePage, SearchResults, MusicianDetail, AboutPage, SubmitPage, HowItWorksPage, PrivacyPolicy, VerificationResult, InstrumentsPage, InstrumentDetail, ContactPage, AdminLogin, AdminReviewQueue, AdminSubmissionDetail
    components/      # Layout, SearchBar, AutocompleteInput, MusicianCard, LineageTree, InstrumentFilter
    content/         # features.md, privacy-policy.md, nationalities.json
  vite.config.js     # Tailwind plugin + API proxy to :8000
seed-musicians.csv, seed-institutions.csv, seed-instruments.csv, seed-lineage.csv, seed-sources.csv, seed-lineage-sources.csv
Dockerfile               # Multi-stage: builds frontend, then Python production image
railway.toml              # Railway deployment config
start.sh                  # Entrypoint: alembic upgrade, seed, uvicorn
```

## Running Locally

```bash
# Backend (from backend/)
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_data
python -m uvicorn app.main:app --port 8000

# Frontend (from frontend/)
# Node.js is installed via fnm: eval "$(fnm env)" to load it in bash
npm install
npm run dev
```

Frontend dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Implementation Rules — Do Not Deviate

- **Admin auth**: Login sets a session cookie. Password checked against `ADMIN_PASSWORD` env var. No bearer tokens, no HTTP Basic Auth, no user management table.
- **Frontend styling**: Tailwind CSS utility classes only. No component library (no shadcn, no Material UI, no Chakra).
- **Frontend build**: Vite builds to `frontend/dist/`. Do NOT have Vite output into a backend subdirectory. During dev, Vite on `:5173` proxies API to FastAPI on `:8000`.
- **Alembic**: Auto-generate migrations from SQLAlchemy models. Do not hand-write migrations.
- **Seed data**: Loaded from CSV files via `python -m app.seed_data`. Must be idempotent (checks existence before inserting). CSVs use integer IDs for cross-referencing.
- **SQLAlchemy 2.0 style**: Mapped classes, `select()` statements, `selectinload()` for eager loading.
- **Data model**: Do not simplify the schema. All tables from the spec must exist.
- **Status filtering**: All public-facing queries MUST filter to `status='active'`. Pending records are only visible in admin endpoints.
- **SITE_NAME constants**: Use `SITE_NAME` / `SITE_NAME_SHORT` / `SITE_ACRONYM` from `constants.js` — no hardcoded site name in components.

## Key Data Model Notes

- Dates are free-text strings (not DATE columns) — historical records have partial/approximate dates.
- Lineage is a DAG, not a tree — students commonly have multiple teachers.
- `name_search` columns are auto-generated via `unidecode().lower()` for diacritical-normalized search.
- `musician_names` table is for legitimate alternate names (transliterations, maiden names), NOT misspellings.
- Unique constraint on lineage: `(teacher_id, student_id, institution_id)`.
- `status` field on musicians, lineage, and institutions: `'active'` (public) or `'pending'` (in review queue).
- `parent_id` on instruments for companion/doubling relationships (English Horn → Oboe, Piccolo → Flute).
- Sources and lineage_sources tables link citations to lineage records. Included in all LineageRead API responses.

## Deployment (Railway)

- Multi-stage Dockerfile: Node 22 builds frontend, Python 3.12-slim runs backend
- `start.sh` runs alembic migrations + seed data + uvicorn on every deploy
- Frontend dist is copied to `backend/static/` and served by FastAPI's StaticFiles + SPA catch-all
- Railway provides `PORT` env var; uvicorn binds to `0.0.0.0:$PORT`
- Railway deploys from `deploy` branch (merge main → deploy, then push)
- Health check: `GET /api/v1/health`

## Environment Variables

- `DATABASE_URL` — defaults to `sqlite:///./musician_genealogy.db` (set by Railway Postgres plugin)
- `ADMIN_PASSWORD` — defaults to `admin` (set a real one in Railway)
- `ANTHROPIC_API_KEY` — for AI-assisted submission parsing (Phase 3)
- `RESEND_API_KEY` — for transactional emails (verification, approval/rejection notifications)
- `RESEND_FROM_EMAIL` — sender address, defaults to `Musician Genealogy Project <noreply@mail.musician-genealogy.org>`
- `APP_BASE_URL` — production URL for email links, defaults to `http://localhost:5173`
- `VERIFICATION_TOKEN_EXPIRY_DAYS` — days before unverified submissions are purged, defaults to `7`
- `CONTACT_EMAIL` — displayed on privacy policy page (via `/api/v1/config/public`)
- `CORS_ORIGINS` — defaults to `http://localhost:5173` (not needed in production, same-origin)
- `PORT` — set by Railway automatically

## Phase Status

### Phase 1: Foundation — COMPLETE
- All 12 SQLAlchemy models with migrations
- FastAPI CRUD endpoints for all entities
- Seed database from 6 CSV files (110+ musicians, 39 institutions, 55 instruments)
- Search with diacritical normalization and autocomplete
- React frontend: search, search results, musician detail
- Admin auth (session cookie)
- Companion instrument filtering (parent_id)

### Phase 2: Tree Visualization — MOSTLY COMPLETE
- D3.js LineageTree component on musician detail page (centerpiece)
- Bidirectional: teachers up, students down, root highlighted
- Solid/dashed/dotted lines by relationship type
- Show all connections toggle (default: primary only)
- Expandable nodes with lazy-load via API
- Terminal node detection (over-fetch by 1 depth level)
- Zoom, pan, auto-fit, click-to-navigate
- **Not done**: Full-page `/musician/:id/tree` route, layout options (horizontal/force-directed), responsive/mobile touch, node hover showing all relationships

### Phase 3: Community & Polish — MOSTLY COMPLETE
- Structured submission form (public) with autocomplete
- AI free-text parsing via Claude Haiku (`/submissions/parse-text`)
- Admin review queue with per-record approve/reject
- Honeypot anti-spam + IP rate limiting
- Source citations: CRUD API, seed data, included in lineage responses
- About page, How It Works page, Privacy Policy page
- Nationalities reference list for submissions
- Email verification via Resend: submissions start as 'unverified', verification email sent on submit, token click flips to 'submitted'
- Approval/rejection notification emails to submitters
- Expired unverified submissions purged on startup (configurable via VERIFICATION_TOKEN_EXPIRY_DAYS)
- Privacy policy dynamically inlines contact email and expiry days from env vars
- **Not done**: admin research endpoint, responsive design, institution detail pages

### Phase 4: SEO and Growth — NOT STARTED
- SEO-friendly URLs, Open Graph tags, analytics
- "What's New" changelog widget (future idea)

### Phase 5: Multi-Instrument & i18n — PARTIALLY STARTED
- `/instruments` browse page and `/instrument/:id` detail page — COMPLETE
- i18n / react-i18next localization — NOT STARTED
- Trusted contributor role, bulk import tools — NOT STARTED

## Data

- 110+ musicians (93 oboists, 15 pianists, 3 cellists)
- 39 institutions across USA, France, Russia
- 55 instruments with parent/companion relationships
- 130+ lineage relationships
- 4 sources with 8 lineage-source links
- Pianist lineage: Morozova → Shakin → Serebryakov → Nikolayev → Safonov → Leschetizky → Czerny → Beethoven

## Future Ideas

- **"What's New" changelog widget** — Bake git commit messages into a JSON file at Docker build time, run them through the Claude API to rewrite as friendly non-technical changelog entries. Costs nothing at runtime. Good Phase 4 candidate.

# Git Conventions
- Commit messages use imperative mood (e.g., "Add search endpoint" not "Added search endpoint")
- First line: concise summary under 72 characters
- Blank line, then bullet points with details if needed
