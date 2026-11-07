"""NewsService: checks the cache, calls the provider on a miss, stores and returns the result.

Rules (see the design document, Caching and refresh schedule):
- fresh entry: returned as is ("hit")
- stale entry: returned at once and a background refresh starts ("stale")
- missing/expired: the reader waits for one fetch ("miss"); 502 if it fails
- single flight: concurrent misses for one key share one feed request
- failed refresh: the stale copy stays in place and the failure is logged
"""

import asyncio
import logging
import time
from datetime import datetime, timezone

from .breaker import CircuitBreaker
from .cache import CacheEntry, Freshness, NewsCache, cache_key
from .config import Settings
from .errors import BreakerOpen, FeedError, UpstreamUnavailable
from .history import History, NullHistory
from .metrics import CACHE_RESULTS, FEED_FAILURES
from .models import NewsResponse, iso_utc
from .normalizer import normalize
from .provider import NewsProvider

log = logging.getLogger("news.service")


class NewsService:
    def __init__(
        self,
        provider: NewsProvider,
        cache: NewsCache,
        breaker: CircuitBreaker,
        settings: Settings,
        history: History | None = None,
    ):
        self.provider = provider
        self.cache = cache
        self.breaker = breaker
        self.settings = settings
        self.history = history or NullHistory()
        self._inflight: dict[str, asyncio.Task[CacheEntry]] = {}
        self._background: set[asyncio.Task] = set()

    # --- public ------------------------------------------------------------------------

    async def get_news(self, country: str, section: str) -> tuple[NewsResponse, str]:
        """Return the response and the cache result: 'hit', 'stale' or 'miss'."""
        key = cache_key(country, section)
        cached = self.cache.get(key)
        if cached is not None:
            entry, freshness = cached
            if freshness is Freshness.FRESH:
                result = "hit"
            else:
                result = "stale"
                self._refresh_in_background(country, section)
        else:
            result = "miss"
            try:
                entry = await self.refresh(country, section)
            except FeedError as e:
                raise UpstreamUnavailable(str(e)) from e
        CACHE_RESULTS.labels(result).inc()
        return self._response(country, section, entry), result

    async def refresh(self, country: str, section: str) -> CacheEntry:
        """Fetch and store one view. Concurrent callers for the same key share one fetch."""
        key = cache_key(country, section)
        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(self._fetch_and_store(country, section), name=f"fetch {key}")
            self._inflight[key] = task
            task.add_done_callback(lambda _t, k=key: self._inflight.pop(k, None))
        # shield: a reader that disconnects must not cancel the fetch others are waiting on
        return await asyncio.shield(task)

    async def aclose(self) -> None:
        tasks = list(self._background) + list(self._inflight.values())
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await self.history.aclose()

    # --- internals ---------------------------------------------------------------------

    def _refresh_in_background(self, country: str, section: str) -> None:
        if cache_key(country, section) in self._inflight:
            return

        async def run() -> None:
            try:
                await self.refresh(country, section)
            except FeedError:
                pass  # already logged; the stale copy stays in place

        self._spawn(run())

    def _spawn(self, coro) -> None:
        task = asyncio.create_task(coro)
        self._background.add(task)
        task.add_done_callback(self._background.discard)

    async def _fetch_and_store(self, country: str, section: str) -> CacheEntry:
        started_wall = datetime.now(timezone.utc)
        started = time.perf_counter()
        try:
            if not self.breaker.allow():
                raise BreakerOpen("feed calls paused by circuit breaker")
            raw = await self.provider.fetch(country, section)
        except BreakerOpen as e:
            log.info("feed skipped", extra={"country": country, "section": section, "error": str(e)})
            raise
        except Exception as e:
            self.breaker.record_failure()
            duration_ms = int((time.perf_counter() - started) * 1000)
            FEED_FAILURES.labels(country).inc()
            message = str(e) if isinstance(e, FeedError) else f"unexpected {type(e).__name__}: {e}"
            log.warning(
                "feed fetch failed",
                extra={"country": country, "section": section, "duration_ms": duration_ms, "error": message},
                exc_info=not isinstance(e, FeedError),
            )
            self._spawn(self.history.record_fetch(country, section, started_wall, duration_ms, "error", 0, message))
            raise FeedError(message) from e

        self.breaker.record_success()
        now = datetime.fromtimestamp(self.cache.clock(), timezone.utc)
        articles = normalize(
            raw,
            now=now,
            max_age_days=self.settings.max_article_age_days,
            max_articles=self.settings.max_articles,
            summary_max_chars=self.settings.summary_max_chars,
        )
        entry = self.cache.set(cache_key(country, section), articles)
        duration_ms = int((time.perf_counter() - started) * 1000)
        log.info(
            "feed fetch",
            extra={
                "country": country,
                "section": section,
                "duration_ms": duration_ms,
                "raw_items": len(raw),
                "item_count": len(articles),
            },
        )
        status = "ok" if articles else "empty"
        self._spawn(self.history.record_fetch(country, section, started_wall, duration_ms, status, len(articles), None))
        if articles:
            self._spawn(self.history.record_articles(country, section, articles, now))
        return entry

    @staticmethod
    def _response(country: str, section: str, entry: CacheEntry) -> NewsResponse:
        return NewsResponse(
            country=country,
            section=section,  # type: ignore[arg-type]
            fetchedAt=iso_utc(datetime.fromtimestamp(entry.fetched_at, timezone.utc)),
            articles=entry.articles,
        )
