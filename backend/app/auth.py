import os
import secrets

from fastapi import HTTPException, Request


ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
SESSION_COOKIE_NAME = "session"

# Server-side session store (in-memory; sessions cleared on deploy, which is acceptable)
_active_sessions: set[str] = set()


def create_session() -> str:
    """Generate a random session token and register it."""
    token = secrets.token_urlsafe(32)
    _active_sessions.add(token)
    return token


def invalidate_session(token: str):
    """Remove a session token server-side."""
    _active_sessions.discard(token)


def require_admin(request: Request):
    session_value = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_value or session_value not in _active_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
