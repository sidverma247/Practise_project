# Task 5 — URL Shortener

Submit a long URL, get a 6-char code. Hitting the code redirects. Supports custom
aliases, expiry (TTL), duplicate dedupe, and click tracking.

## API
| Method | Path | Description |
|--------|------|-------------|
| POST | `/shorten` | `{url, alias?, ttl?}` → entry (201) |
| GET | `/:code` | 302 redirect to original |
| GET | `/info/:code` | entry metadata + click count |

## Run
```bash
pip install flask
python shortener.py
curl -X POST localhost:3000/shorten -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```

## Bonus features
- **Expiration** — pass `ttl` (seconds); expired codes return 404.
- **Click tracking** — every redirect increments `clicks`, visible via `/info`.

## Tests
```bash
pytest test_shortener.py -v --cov=shortener
```
