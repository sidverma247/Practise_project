# Practice Tasks — Completed Solutions

All 12 tasks from `04_PRACTICE_TASKS.md`, implemented in **Python** with full
code, a pytest suite, and a per-task README. Each task lives in its own folder.

## Results

| # | Task | Folder | Tests |
|---|------|--------|-------|
| 1 | README Generator | `task01_readme_generator` | 10 passed |
| 2 | Todo List API | `task02_todo_api` | 13 passed |
| 3 | Test Case Writer (applyDiscount) | `task03_test_writer` | 15 passed |
| 4 | Password Strength Checker | `task04_password_checker` | 17 passed |
| 5 | URL Shortener | `task05_url_shortener` | 14 passed |
| 6 | Data Validator | `task06_data_validator` | 18 passed |
| 7 | Rate Limiter | `task07_rate_limiter` | 10 passed |
| 8 | JSON Configuration Manager | `task08_config_manager` | 13 passed |
| 9 | Simple Cache Layer | `task09_cache_layer` | 15 passed |
| 10 | Logger with Levels | `task10_logger` | 12 passed |
| 11 | Event Emitter System | `task11_event_emitter` | 12 passed |
| 12 | Simple ORM-like Layer | `task12_orm` | 12 passed |

**Total: 161 tests, all passing.**

## Running

```bash
pip install pytest pytest-cov flask
# one task
cd task02_todo_api && pytest -v --cov

# everything
pytest        # from this directory, discovers all task*/ suites
```

## Notes on the specs

A couple of the PRDs had small inconsistencies, handled deliberately:

- **Task 4 (Password Checker):** the scoring table allows length to add `+1`
  (≥8) *and* `+2` (≥12) cumulatively, giving a max of 8 — but the rating table
  caps at 7. Length is scored as non-cumulative tiers so the maximum is exactly 7.
- **Tasks using time (rate limiter, cache, logger):** clocks are injectable, so
  TTL/window/timestamp behaviour is tested deterministically rather than with `sleep`.

## Design choices

- The Todo and URL-shortener APIs use Flask with an app factory, so tests run
  against an in-process test client (no server, no ports).
- Pure-logic cores (RateLimiter, Cache, EventEmitter, validators) are framework-
  agnostic classes; the web glue is a thin layer on top.
- The ORM is backed by SQLite (`:memory:` by default) and creates tables from the
  field schema.
