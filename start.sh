#!/bin/bash
set -e

cd /app/backend

echo "Running Alembic migrations..."
python -m alembic upgrade head

echo "Running seed data loader..."
python -m app.seed_data

echo "CONTACT_EMAIL is set: $([ -n \"$CONTACT_EMAIL\" ] && echo 'yes' || echo 'no')"
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
