# Task 9 — Simple Cache Layer

In-memory key/value cache with per-entry TTL, hit/miss statistics, and a lock for
thread safety. TTL is checked lazily on access (and expired entries are evicted).

## API
```python
from cache import Cache
c = Cache()
c.set("key", "value", ttl=300)   # 5-minute TTL (omit ttl = never expire)
c.get("key")                      # value or None
c.has("key")                      # bool
c.delete("key")                   # also c.del_("key")
c.ttl("key", 600)                 # extend/replace TTL
c.clear()
c.stats()                         # Stats(entries, hits, misses, hit_rate)
```

## Notes
- Deterministic tests use an injectable clock (`Cache(now=fake_clock)`).
- `stats().hit_rate` is `hits / (hits + misses)`, rounded to 4 dp.

## Tests
```bash
pytest test_cache.py -v --cov=cache
```
