# Musician Genealogy Project

Web app for exploring pedagogical genealogies of musicians — who studied with whom, where, and when. Launching with oboe, designed for any instrument.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, Python 3.12+ |
| Database | SQLite (local dev), PostgreSQL (production via Railway) |
| Frontend | React (Vite), Tailwind CSS v4, React Router |
| Search | unidecode for diacritical normalization; pg_trgm for fuzzy matching (Postgres only) |
| Tree Viz | D3.js (Phase 2, not yet built) |

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app, CORS, router registration
    models.py        # All SQLAlchemy models (10 tables)
    schemas.py       # Pydantic request/response schemas
    database.py      # Engine, session, Base
    auth.py          # Session cookie admin auth
    seed_data.py     # Idempotent CSV loader (python -m app.seed_data)
    routers/         # auth, musicians, lineage, instruments, institutions, search, submissions
  alembic/           # Migrations (auto-generated from models)
  alembic.ini
  requirements.txt
frontend/
  src/
    main.jsx, App.jsx, api.js, index.css
    pages/           # HomePage, SearchResults, MusicianDetail
    components/      # Layout, SearchBar, MusicianCard
  vite.config.js     # Tailwind plugin + API proxy to :8000
seed-musicians.csv, seed-institutions.csv, seed-lineage.csv
```

## Running Locally

```bash
# Backend (from backend/)
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_data
python -m uvicorn app.main:app --port 8000

# Frontend (from frontend/)
# Node.js is installed via fnm: eval "$(fnm env)" to load it
npm install
npx vite --port 5173
```

Frontend dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Implementation Rules — Do Not Deviate

- **Admin auth**: Login sets a session cookie. Password checked against `ADMIN_PASSWORD` env var. No bearer tokens, no HTTP Basic Auth, no user management table.
- **Frontend styling**: Tailwind CSS utility classes only. No component library (no shadcn, no Material UI, no Chakra).
- **Frontend build**: Vite builds to `frontend/dist/`. Do NOT have Vite output into a backend subdirectory. During dev, Vite on `:5173` proxies API to FastAPI on `:8000`.
- **Alembic**: Auto-generate migrations from SQLAlchemy models. Do not hand-write migrations.
- **Seed data**: Loaded from CSV files via `python -m app.seed_data`. Must be idempotent. CSVs use integer IDs for cross-referencing.
- **SQLAlchemy 2.0 style**: Mapped classes, `select()` statements.
- **Data model**: Do not simplify the schema. All tables from the spec must exist.
- **Submissions table** exists from Phase 1 even though the form UI is Phase 3.

## Key Data Model Notes

- Dates are free-text strings (not DATE columns) — historical records have partial/approximate dates.
- Lineage is a DAG, not a tree — students commonly have multiple teachers.
- `name_search` columns are auto-generated via `unidecode().lower()` for diacritical-normalized search.
- `musician_names` table is for legitimate alternate names (transliterations, maiden names), NOT misspellings.
- Unique constraint on lineage: `(teacher_id, student_id, institution_id)`.

## Environment Variables

- `DATABASE_URL` — defaults to `sqlite:///./musician_genealogy.db`
- `ADMIN_PASSWORD` — defaults to `admin`
- `CORS_ORIGINS` — defaults to `http://localhost:5173`

## Phase Status

- Phase 1: COMPLETE (backend + frontend: models, migrations, seed data, API, search with autocomplete, musician detail)
- Phase 2: Tree visualization (D3.js) — not started
- Phase 3: Submission form UI, admin review queue, responsive design — not started
- Phase 4: SEO, Open Graph, analytics — not started

# Git Conventions
- Commit messages use imperative mood (e.g., "Add search endpoint" not "Added search endpoint")
- First line: concise summary under 72 characters
- Blank line, then bullet points with details if needed