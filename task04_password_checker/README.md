# Task 4 — Password Strength Checker

Scores a password 0–7 across length, character variety, and common-password
detection, then rates it Weak / Fair / Good / Strong with specific feedback.

## Scoring
| Criteria | Points |
|----------|--------|
| Length ≥12 → +2, else ≥8 → +1 (tiered, not cumulative) | +1 / +2 |
| Uppercase | +1 |
| Lowercase | +1 |
| Number | +1 |
| Special char | +1 |
| Not common | +1 |

Rating: 0–2 Weak · 3–4 Fair · 5–6 Good · 7 Strong

> Note: the PRD listed length as `≥8 +1` **and** `≥12 +2` cumulatively, which
> allows a max of 8 while the rating table caps at 7. Length is scored as
> non-cumulative tiers here so the maximum is exactly 7.

## Files
- `password_checker.py` — `check_password(pw)` → `Result(score, rating, feedback)`
- `common_passwords.txt` — small blocklist
- `test_password_checker.py` — 17