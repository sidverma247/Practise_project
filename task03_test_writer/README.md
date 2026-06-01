# Task 3 — Test Case Writer

The original `applyDiscount` JS function ported to Python (`discount.py`) plus a
comprehensive test suite derived from a structured checklist.

- `discount.py` — function under test
- `TEST_CHECKLIST.md` — normal / combination / edge / error cases
- `test_discount.py` — 15 pytest cases implementing the checklist

## Key insight tested
Discounts don't stack — `Math.max` means the **best single** discount wins
(customer-type vs coupon), which is the main edge worth covering.

## Run
```bash
pytest test_discount.py -v --cov=discount   # expect 100% coverage
```
