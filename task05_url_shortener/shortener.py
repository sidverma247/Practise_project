"""URL shortener service — Flask app + reusable Store with codes, expiry, clicks."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Optional
import secrets
import string
from flask import Flask, jsonify, request, redirect

_ALPHABET = string.ascii_letters + string.digits


def _now():
    return datetime.now(timezone.utc)


@dataclass
class Entry:
    code: str
    url: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    clicks: int = 0


class Store:
    """In-memory URL store with optional expiry and custom aliases."""

    def __init__(self):
        self._by_code: dict[str, Entry] = {}
        self._by_url: dict[str, str] = {}  # url -> code (for dedupe, no-expiry only)

    def _gen_code(self) -> str:
        while True:
            code = "".join(secrets.choice(_ALPHABET) for _ in range(6))
            if code not in self._by_code:
                return code

    def shorten(self, url: str, alias: Optional[str] = None, ttl: Optional[int] = None) -> Entry:
        if not isinstance(url, str) or not url.strip():
            raise ValueError("url is required")
        url = url.strip()
        if alias:
            if alias in self._by_code:
                raise ValueError(f"alias '{alias}' already in use")
            code = alias
        else:
            # dedupe identical URLs that have no ttl
            if ttl is None and url in self._by_url:
                return self._by_code[self._by_url[url]]
            code = self._gen_code()
        expires = _now() + timedelta(seconds=ttl) if ttl else None
        entry = Entry(code=code, url=url, created_at=_now(), expires_at=expires)
        self._by_code[code] = entry
        if ttl is None and not alias:
            self._by_url[url] = code
        return entry

    def _expired(self, entry: Entry) -> bool:
        return entry.expires_at is not None and _now() >= entry.expires_at

    def resolve(self, code: str) -> Optional[Entry]:
        entry = self._by_code.get(code)
        if entry is None or self._expired(entry):
            return None
        entry.clicks += 1
        return entry

    def info(self, code: str) -> Optional[Entry]:
        entry = self._by_code.get(code)
        if entry is None or self._expired(entry):
            return None
        return entry


def _entry_dict(e: Entry) -> dict:
    return {
        "code": e.code,
        "url": e.url,
        "createdAt": e.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expiresAt": e.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ") if e.expires_at else None,
        "clicks": e.clicks,
    }


def create_app(store: Optional[Store] = None) -> Flask:
    app = Flask(__name__)
    store = store or Store()

    @app.post("/shorten")
    def shorten():
        data = request.get_json(silent=True) or {}
        try:
            entry = store.shorten(data.get("url"), data.get("alias"), data.get("ttl"))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        return jsonify(_entry_dict(entry)), 201

    @app.get("/<code>")
    def go(code):
        entry = store.resolve(code)
        if not entry:
            return jsonify({"error": "Not found or expired"}), 404
        return redirect(entry.url, code=302)

    @app.get("/info/<code>")
    def info(code):
        entry = store.info(code)
        if not entry:
            return jsonify({"error": "Not found or expired"}), 404
        return jsonify(_entry_dict(entry)), 200

    return app


if __name__ == "__main__":  # pragma: no cover
    create_app().run(port=3000, debug=True)
