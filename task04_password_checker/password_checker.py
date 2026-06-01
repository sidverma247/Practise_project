"""Password strength checker — score-based rating with specific feedback."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Set
import os
import re

_DEFAULT_COMMON = os.path.join(os.path.dirname(__file__), "common_passwords.txt")


def load_common_passwords(path: str = _DEFAULT_COMMON) -> Set[str]:
    try:
        with open(path) as f:
            return {line.strip().lower() for line in f if line.strip()}
    except FileNotFoundError:
        return set()


@dataclass
class Result:
    score: int
    rating: str
    feedback: List[str] = field(default_factory=list)


def _rating(score: int) -> str:
    if score <= 2:
        return "Weak"
    if score <= 4:
        return "Fair"
    if score <= 6:
        return "Good"
    return "Strong"


def check_password(password: str, common: Set[str] | None = None) -> Result:
    if common is None:
        common = load_common_passwords()
    if not isinstance(password, str):
        raise TypeError("password must be a string")

    score = 0
    feedback: List[str] = []

    # Length scored as non-cumulative tiers so the max total stays 7.
    if len(password) >= 12:
        score += 2
    elif len(password) >= 8:
        score += 1
        feedback.append("12+ characters is much stronger")
    else:
        feedback.append("Use at least 8 characters")

    if re.search(r"[A-Z]", password):
        score += 1
    else:
        feedback.append("Add an uppercase letter")
    if re.search(r"[a-z]", password):
        score += 1
    else:
        feedback.append("Add a lowercase letter")
    if re.search(r"[0-9]", password):
        score += 1
    else:
        feedback.append("Add a number")
    if re.search(r"[^A-Za-z0-9]", password):
        score += 1
    else:
        feedback.append("Add a special character")

    if password.lower() in common:
        feedback.append("This is a commonly used password — avoid it")
    else:
        score += 1

    if not feedback:
        feedback.append("Excellent password!")

    return Result(score=score, rating=_rating(score), feedback=feedback)
