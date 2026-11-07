"""In-memory cache of finished article lists, keyed by view (news:<COUNTRY>:<section>).

An entry is fresh for the fresh window (5 minutes for an empty result), stale until the
stale window, then expired. Expired entries count as missing. The least recently used
entry is evicted beyond max_entries. Redis is the upgrade if the service ever runs on
more than one instance.
"""

import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

from .models import Article


class Freshness(str, Enum):
    FRESH = "fresh"
    STALE = "stale"


@dataclass(frozen=True)
class CacheEntry:
    articles: list[Article]
    fetched_at: float  # epoch seconds


def cache_key(country: str, section: str) -> str:
    return f"news:{country}:{section}"


class NewsCache:
    def __init__(
        self,
        fresh_seconds: float,
        stale_seconds: float,
        empty_fresh_seconds: float,
        max_entries: int,
        clock: Callable[[], float] = time.time,
    ):
        self.fresh_seconds = fresh_seconds
        self.stale_seconds = stale_seconds
        self.empty_fresh_seconds = empty_fresh_seconds
        self.max_entries = max_entries
        self.clock = clock
        self._data: OrderedDict[str, CacheEntry] = OrderedDict()

    def get(self, key: str) -> tuple[CacheEntry, Freshness] | None:
        """Return the entry and whether it is fresh or stale, or None when missing or expired."""
        entry = self._data.get(key)
        if entry is None:
            return None
        age = self.clock() - entry.fetched_at
        if age >= self.stale_seconds:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        fresh_for = self.empty_fresh_seconds if not entry.articles else self.fresh_seconds
        return entry, (Freshness.FRESH if age < fresh_for else Freshness.STALE)

    def set(self, key: str, articles: list[Article]) -> CacheEntry:
        entry = CacheEntry(articles=articles, fetched_at=self.clock())
        self._data[key] = entry
        self._data.move_to_end(key)
        while len(self._data) > self.max_entries:
            self._data.popitem(last=False)
        return entry

    def __len__(self) -> int:
        return len(self._data)
