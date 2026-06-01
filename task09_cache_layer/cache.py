"""In-memory cache with TTL and statistics. Thread-safe via a lock."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Optional
import threading
import time


@dataclass
class Stats:
    entries: int
    hits: int
    misses: int
    hit_rate: float


class Cache:
    def __init__(self, now: Callable[[], float] = time.time):
        self._now = now
        self._store: dict[str, tuple[Any, Optional[float]]] = {}  # key -> (value, expires_at)
        self._hits = 0
        self._misses = 0
        self._lock = threading.Lock()

    def _expired(self, expires_at: Optional[float]) -> bool:
        return expires_at is not None and self._now() >= expires_at

    def set(self, key: str, value: Any, ttl: Optional[float] = None) -> None:
        expires = self._now() + ttl if ttl else None
        with self._lock:
            self._store[key] = (value, expires)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            item = self._store.get(key)
            if item is None:
                self._misses += 1
                return default
            value, expires = item
            if self._expired(expires):
                del self._store[key]
                self._misses += 1
                return default
            self._hits += 1
            return value

    def has(self, key: str) -> bool:
        with self._lock:
            item = self._store.get(key)
            if item is None:
                return False
            if self._expired(item[1]):
                del self._store[key]
                return False
            return True

    def delete(self, key: str) -> bool:
        with self._lock:
            return self._store.pop(key, None) is not None

    # alias to match the PRD's cache.del
    def del_(self, key: str) -> bool:
        return self.delete(key)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    def ttl(self, key: str, new_ttl: float) -> bool:
        """Update the TTL of an existing key. Returns False if absent/expired."""
        with self._lock:
            item = self._store.get(key)
            if item is None or self._expired(item[1]):
                self._store.pop(key, None)
                return False
            self._store[key] = (item[0], self._now() + new_ttl)
            return True

    def stats(self) -> Stats:
        with self._lock:
            total = self._hits + self._misses
            rate = self._hits / total if total else 0.0
            return Stats(entries=len(self._store), hits=self._hits,
                         misses=self._misses, hit_rate=round(rate, 4))
