import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, musicians, lineage, instruments, institutions, search, submissions

app = FastAPI(
    title="Musician Genealogy API",
    description="Pedagogical genealogies of musicians — who studied with whom, where, and when.",
    version="0.1.0",
)

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
app.include_router(submissions.router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
