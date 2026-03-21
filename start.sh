#!/bin/bash
set -e

cd /app/backend

echo "Running Alembic migrations..."
python -m alembic upgrade head

echo "Running seed data loader..."
python -m app.seed_data

# Debug: dump all env vars containing CONTACT
env | grep -i contact || echo "No CONTACT vars found in env"
python -c "import os; matches=[k for k in os.environ if 'CONTACT' in k.upper()]; print(f'Python env CONTACT keys: {matches}')"
echo "Starting uvicorn..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
