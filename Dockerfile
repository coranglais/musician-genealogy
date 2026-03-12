# --- Stage 1: Build frontend ---
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# --- Stage 2: Production ---
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy seed data CSVs
COPY seed-musicians.csv seed-institutions.csv seed-lineage.csv ./

# Copy built frontend into backend/static for serving
COPY --from=frontend-build /app/frontend/dist ./backend/static

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 8000

CMD ["./start.sh"]
