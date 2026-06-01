# Task 6 — Data Validator

Validate objects against a declarative schema. Returns `ValidationResult(valid, errors)`
with clear, per-field messages.

## Supported types
`string` (min/max length), `number` (min/max value), `email`, `url`, `date` (ISO `YYYY-MM-DD`).
Each rule may set `required: True`.

## Usage
```python
from validator import validate
schema = {
  "name":  {"type": "string", "required": True, "min": 2, "max": 50},
  "email": {"type": "email",  "required": True},
  "age":   {"type": "number", "min": 18, "max": 120},
}
res = validate({"name": "Ann", "email": "a@b.com", "age": 30}, schema)
res.valid     # True
res.errors    # []
```

## Tests
```bash
pytest test_validator.py -v --cov=validator   # 18 cases, 2+ per type
```
