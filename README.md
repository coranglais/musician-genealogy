# Musician Genealogy

A web application for exploring pedagogical genealogies of musicians — who studied with whom, where, and when. Launching with **oboe** as the inaugural instrument, designed from day one to support any instrument.

The core differentiator from existing genealogy sites (which tend to be flat searchable tables) is an **interactive tree visualization** that lets users explore teacher–student lineages visually.

## Features

- **Search** with diacritical normalization (find Dvořák by typing "dvorak") and autocomplete
- **Musician detail pages** with biographical info, teachers, and students
- **Relationship types** — formal study, private lessons, masterclass, festival, informal mentorship — each with distinct visual weight
- **Lineage tree API** — recursive ancestor/descendant traversal with configurable depth
- **Curated editorial model** — all data is reviewed before publication; community members can submit suggestions

## Current Data

77 oboists spanning five generations of the French and American oboe schools, from Georges Gillet (Paris Conservatoire, 1854–1920) through the Tabuteau lineage to active performers and teachers today. 31 institutions, 98 documented teacher–student relationships.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL (production), SQLite (local dev) |
| Frontend | React, Vite, Tailwind CSS |
| Deployment | Railway |

## Running Locally

```bash
# Backend (from backend/)
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_data
python -m uvicorn app.main:app --port 8000

# Frontend (from frontend/)
npm install
npx vite --port 5173
```

The Vite dev server proxies `/api` requests to the FastAPI backend on port 8000.

## Seed Data Sources

- Storch, Laila. *Marcel Tabuteau: How Do You Expect to Play the Oboe If You Can't Peel a Mushroom?* (Indiana UP, 2008)
- Burgess & Haynes. *The Oboe* (Yale UP, 2004)
- Cruz, Danny. "Who was your oboe teacher's teacher?" oboefiles.com
