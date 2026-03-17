import os

from fastapi import APIRouter, Response

from ..auth import ADMIN_PASSWORD, SESSION_COOKIE_NAME

IS_PRODUCTION = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID"))
from ..schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response):
    if not ADMIN_PASSWORD:
        return LoginResponse(message="Admin login is disabled")
    if body.password != ADMIN_PASSWORD:
        return LoginResponse(message="Invalid password")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value="authenticated",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=60 * 60 * 24,  # 24 hours
    )
    return LoginResponse(message="Logged in")


@router.post("/logout", response_model=LoginResponse)
def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return LoginResponse(message="Logged out")
