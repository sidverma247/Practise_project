"""Fixed-window rate limiter — core logic + Flask middleware factory."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Callable, Dict
import time


@dataclass
class Decision:
    allowed: bool
    limit: int
    remaining: int
    reset: int  # epoch seconds when the window resets


class RateLimiter:
    """Fixed-window counter keyed by an arbitrary identifier (e.g. IP)."""

    def __init__(self, window_ms: int = 60000, max_requests: int = 100, now: Callable[[], float] = time.time):
        if window_ms <= 0 or max_requests <= 0:
            raise ValueError("window_ms and max_requests must be positive")
        self.window = window_ms / 1000.0
        self.max = max_requests
        self._now = now
        self._windows: Dict[str, list] = {}  # key -> [window_start, count]

    def check(self, key: str) -> Decision:
        now = self._now()
        start, count = self._windows.get(key, [now, 0])
        if now - start >= self.window:
            start, count = now, 0  # window expired -> reset

        count += 1
        self._windows[key] = [start, count]
        reset = int(start + self.window)
        allowed = count <= self.max
        remaining = max(0, self.max - count)
        return Decision(allowed=allowed, limit=self.max, remaining=remaining, reset=reset)


def rate_limit(window_ms: int = 60000, max_requests: int = 100):
    """Flask-style decorator/middleware factory. Returns a before_request handler."""
    from flask import request, jsonify

    limiter = RateLimiter(window_ms=window_ms, max_requests=max_requests)

    def middleware():
        ip = request.remote_addr or "unknown"
        d = limiter.check(ip)
        headers = {
            "X-RateLimit-Limit": str(d.limit),
            "X-RateLimit-Remaining": str(d.remaining),
            "X-RateLimit-Reset": str(d.reset),
        }
        if not d.allowed:
            resp = jsonify({"error": "Too Many Requests"})
            resp.status_code = 429
            resp.headers.extend(headers)
            return resp
        request.environ["_ratelimit_headers"] = headers
        return None

    return middleware, limiter
