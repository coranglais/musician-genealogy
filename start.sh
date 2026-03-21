#!/bin/bash
set -e

cd /app/backend

echo "Running Alembic migrations..."
python -m alembic upgrade head

echo "Running seed data loader..."
python -m app.seed_data

# Ensure all env vars are exported (Railway may set some without export)
export CONTACT_EMAIL="${CONTACT_EMAIL:-}"
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
