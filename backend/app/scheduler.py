"""Background jobs: pre-warm popular views, and (with a database) the nightly cleanup."""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

from .errors import FeedError
from .metrics import PREWARM_DURATION, PREWARM_FAILURES
from .models import SECTIONS
from .service import NewsService

log = logging.getLogger("news.scheduler")


async def prewarm_once(service: NewsService, countries: list[str], pause_seconds: float) -> None:
    """Refresh every section of each pre-warm country, pausing between fetches."""
    started = time.perf_counter()
    failures = 0
    first = True
    for country in countries:
        for section in SECTIONS:
            if service.breaker.is_open:
                log.info("pre-warm skipped: circuit breaker open")
                PREWARM_DURATION.observe(time.perf_counter() - started)
                return
            if not first:
                await asyncio.sleep(pause_seconds)
            first = False
            try:
                await service.refresh(country, section)
            except FeedError:
                failures += 1
                PREWARM_FAILURES.inc()
    duration = time.perf_counter() - started
    PREWARM_DURATION.observe(duration)
    log.info("pre-warm finished", extra={"duration_ms": int(duration * 1000), "failures": failures})


async def prewarm_loop(service: NewsService, countries: list[str], interval_seconds: float, pause_seconds: float):
    """Run once at startup, then every interval, until cancelled."""
    if not countries:
        return
    while True:
        try:
            await prewarm_once(service, countries, pause_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("pre-warm run crashed")
        await asyncio.sleep(interval_seconds)


def _seconds_until(hour_utc: int) -> float:
    now = datetime.now(timezone.utc)
    nxt = now.replace(hour=hour_utc, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


async def nightly_cleanup_loop(service: NewsService, hour_utc: int = 3) -> None:
    while True:
        await asyncio.sleep(_seconds_until(hour_utc))
        await service.history.cleanup()
