"""A small consecutive-failure circuit breaker.

After `threshold` failures in a row, feed calls stop for `open_seconds`. After the pause
one trial call is let through: success closes the breaker, failure opens it again.
"""

import time
from collections.abc import Callable

from .metrics import BREAKER_OPEN


class CircuitBreaker:
    def __init__(self, threshold: int, open_seconds: float, clock: Callable[[], float] = time.monotonic):
        self.threshold = threshold
        self.open_seconds = open_seconds
        self.clock = clock
        self.failures = 0
        self.opened_at: float | None = None
        self._trial_in_flight = False

    @property
    def is_open(self) -> bool:
        """True while calls are paused (the pause has not yet run out)."""
        return self.opened_at is not None and self.clock() - self.opened_at < self.open_seconds

    def allow(self) -> bool:
        if self.opened_at is None:
            return True
        if self.is_open or self._trial_in_flight:
            return False
        self._trial_in_flight = True  # half-open: one trial call
        return True

    def record_success(self) -> None:
        self.failures = 0
        self.opened_at = None
        self._trial_in_flight = False
        BREAKER_OPEN.set(0)

    def record_failure(self) -> None:
        self.failures += 1
        self._trial_in_flight = False
        if self.opened_at is not None or self.failures >= self.threshold:
            self.opened_at = self.clock()
            BREAKER_OPEN.set(1)
