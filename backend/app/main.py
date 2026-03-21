import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from .routers import auth, musicians, lineage, instruments, institutions, search, sources, submissions, parse_text

IS_PRODUCTION = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"))

app = FastAPI(
    title="Musician Genealogy API",
    description="Pedagogical genealogies of musicians — who studied with whom, where, and when.",
    version="0.1.0",
)


# HTTPS redirect + HSTS in production
class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Railway terminates TLS at the proxy; check X-Forwarded-Proto
        proto = request.headers.get("x-forwarded-proto", "https")
        if proto == "http":
            url = request.url.replace(scheme="https")
            return RedirectResponse(str(url), status_code=301)
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


if IS_PRODUCTION:
    app.add_middleware(HTTPSRedirectMiddleware)

# CORS: localhost:5173 for Vite dev server
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(musicians.router)
app.include_router(lineage.router)
app.include_router(instruments.router)
app.include_router(institutions.router)
app.include_router(search.router)
app.include_router(sources.router)
app.include_router(submissions.router)
app.include_router(parse_text.router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/config/public")
def public_config():
    return {
        "site_name": os.getenv("SITE_NAME", "The Musician Genealogy Project"),
        "contact_email": os.getenv("CONTACT_EMAIL", ""),
    }


# Serve frontend static files in production
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
