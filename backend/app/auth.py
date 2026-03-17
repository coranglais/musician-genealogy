import os

from fastapi import Depends, HTTPException, Request


ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
SESSION_COOKIE_NAME = "session"


def require_admin(request: Request):
    session_value = request.cookies.get(SESSION_COOKIE_NAME)
    if session_value != "authenticated":
        raise HTTPException(status_code=401, detail="Not authenticated")
