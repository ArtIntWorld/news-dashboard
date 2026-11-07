"""Per-IP sliding-window rate limit (in memory, one instance)."""

import math
import time
from collections import deque
from collections.abc import Callable


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float = 60, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window = window_seconds
        self.clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._last_sweep = clock()

    def check(self, client: str) -> int | None:
        """Record a request. Returns None when allowed, else seconds until the next slot."""
        now = self.clock()
        self._sweep(now)
        hits = self._hits.setdefault(client, deque())
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return max(1, math.ceil(self.window - (now - hits[0])))
        hits.append(now)
        return None

    def _sweep(self, now: float) -> None:
        """Forget idle clients now and then so memory stays bounded."""
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        for key in [k for k, d in self._hits.items() if not d or now - d[-1] >= self.window]:
            del self._hits[key]
