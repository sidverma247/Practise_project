"""Schema-based data validator. Supports string, number, email, url, date types."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, List
import re

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)


def _check_field(name: str, value: Any, rule: dict) -> List[str]:
    errs: List[str] = []
    ftype = rule.get("type", "string")

    if ftype == "string":
        if not isinstance(value, str):
            errs.append(f"{name} must be a string")
            return errs
        if "min" in rule and len(value) < rule["min"]:
            errs.append(f"{name} must be at least {rule['min']} characters")
        if "max" in rule and len(value) > rule["max"]:
            errs.append(f"{name} must be at most {rule['max']} characters")

    elif ftype == "number":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            errs.append(f"{name} must be a number")
            return errs
        if "min" in rule and value < rule["min"]:
            errs.append(f"{name} must be >= {rule['min']}")
        if "max" in rule and value > rule["max"]:
            errs.append(f"{name} must be <= {rule['max']}")

    elif ftype == "email":
        if not isinstance(value, str) or not _EMAIL_RE.match(value):
            errs.append(f"{name} must be a valid email")

    elif ftype == "url":
        if not isinstance(value, str) or not _URL_RE.match(value):
            errs.append(f"{name} must be a valid URL")

    elif ftype == "date":
        if not isinstance(value, str):
            errs.append(f"{name} must be an ISO date string")
        else:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                errs.append(f"{name} must be an ISO date (YYYY-MM-DD)")
    else:
        errs.append(f"{name} has unknown type '{ftype}'")

    return errs


def validate(data: dict, schema: dict) -> ValidationResult:
    """Validate `data` against `schema`. Returns ValidationResult(valid, errors)."""
    if not isinstance(data, dict):
        return ValidationResult(False, ["data must be an object"])

    errors: List[str] = []
    for name, rule in schema.items():
        present = name in data and data[name] is not None
        if not present:
            if rule.get("required"):
                errors.append(f"{name} is required")
            continue
        errors.extend(_check_field(name, data[name], rule))

    return ValidationResult(valid=not errors, errors=errors)
