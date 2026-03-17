import time
from collections import defaultdict

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self):
        self._requests: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, limit: int, window: int):
        """Check rate limit. Raises 429 if exceeded. window is in seconds."""
        now = time.time()
        timestamps = self._requests[key]
        # Prune expired entries
        self._requests[key] = [t for t in timestamps if now - t < window]
        if len(self._requests[key]) >= limit:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        self._requests[key].append(now)


rate_limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_submission_rate(request: Request):
    """10 per IP per day for submissions."""
    ip = get_client_ip(request)
    rate_limiter.check(f"submit:{ip}", limit=10, window=86400)


def check_parse_text_rate(request: Request):
    """10 per IP per day for AI parse-text."""
    ip = get_client_ip(request)
    rate_limiter.check(f"parse:{ip}", limit=10, window=86400)


def check_autocomplete_rate(request: Request):
    """60 per IP per minute for autocomplete."""
    ip = get_client_ip(request)
    rate_limiter.check(f"autocomplete:{ip}", limit=60, window=60)
