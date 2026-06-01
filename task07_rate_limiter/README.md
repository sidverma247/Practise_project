# Task 7 — Rate Limiter

Fixed-window rate limiter. Core `RateLimiter` class is framework-agnostic and
injectable-clock (so tests are deterministic); `rate_limit()` wraps it as Flask
middleware that emits standard headers.

## Headers returned
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```
When the limit is exceeded the middleware returns **429** with the headers attached.

## Usage
```python
from flask import Flask
from rate_limiter import rate_limit
app = Flask(__name__)
mw, _ = rate_limit(window_ms=60000, max_requests=100)
app.before_request(mw)
```
Or use the core class directly:
```python
from rate_limiter import RateLimiter
rl = RateLimiter(window_ms=60000, max_requests=100)
rl.check("1.2.3.4").allowed   # True/False
```

## Design notes
Tracking is O(1) per key (one `[window_start, count]` pair), so memory is bounded
by the number of distinct active keys. Window resets lazily on the next request.

## Tests
```bash
pytest test_rate_limiter.py -v --cov=rate_limiter
```
