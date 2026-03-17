import os

from fastapi import APIRouter, Request, Response

from ..auth import ADMIN_PASSWORD, SESSION_COOKIE_NAME, create_session, invalidate_session
from ..schemas import LoginRequest, LoginResponse

IS_PRODUCTION = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"))

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response):
    if not ADMIN_PASSWORD:
        return LoginResponse(message="Admin login is disabled")
    if body.password != ADMIN_PASSWORD:
        return LoginResponse(message="Invalid password")
    token = create_session()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="strict",
        max_age=60 * 60 * 24,  # 24 hours
    )
    return LoginResponse(message="Logged in")


@router.post("/logout", response_model=LoginResponse)
def logout(request: Request, response: Response):
    session_value = request.cookies.get(SESSION_COOKIE_NAME)
    if session_value:
        invalidate_session(session_value)
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return LoginResponse(message="Logged out")
