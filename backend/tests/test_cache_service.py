import asyncio

import pytest

from app.breaker import CircuitBreaker
from app.cache import Freshness, NewsCache
from app.errors import UpstreamUnavailable
from app.models import Article
from app.service import NewsService
from conftest import FakeClock, FakeProvider

MIN = 60
HOUR = 3600


def make_service(settings, clock, provider):
    cache = NewsCache(
        fresh_seconds=30 * MIN, stale_seconds=6 * HOUR, empty_fresh_seconds=5 * MIN, max_entries=1000, clock=clock
    )
    return NewsService(provider, cache, CircuitBreaker(5, 120), settings)


async def settle():
    for _ in range(5):
        await asyncio.sleep(0)


# --- NewsCache on its own -------------------------------------------------------------


def test_cache_fresh_stale_expired():
    clock = FakeClock()
    cache = NewsCache(30 * MIN, 6 * HOUR, 5 * MIN, 10, clock)
    art = Article(id="x", title="t", source="s", url="https://e/x", publishedAt="2026-11-07T10:00:00Z")
    cache.set("k", [art])
    assert cache.get("k")[1] is Freshness.FRESH
    clock.advance(31 * MIN)
    assert cache.get("k")[1] is Freshness.STALE
    clock.advance(6 * HOUR)
    assert cache.get("k") is None


def test_empty_result_has_short_fresh_window():
    clock = FakeClock()
    cache = NewsCache(30 * MIN, 6 * HOUR, 5 * MIN, 10, clock)
    cache.set("k", [])
    clock.advance(4 * MIN)
    assert cache.get("k")[1] is Freshness.FRESH
    clock.advance(2 * MIN)
    assert cache.get("k")[1] is Freshness.STALE


def test_cache_evicts_least_recently_used():
    cache = NewsCache(30 * MIN, 6 * HOUR, 5 * MIN, 2, FakeClock())
    cache.set("a", [])
    cache.set("b", [])
    cache.get("a")
    cache.set("c", [])
    assert cache.get("b") is None and cache.get("a") is not None and len(cache) == 2


# --- NewsService ----------------------------------------------------------------------


async def test_miss_then_fresh_hit(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    svc = make_service(settings, clock, provider)
    body, result = await svc.get_news("IN", "technology")
    assert result == "miss" and len(body.articles) == 1 and body.country == "IN"
    assert body.articles[0].title == "IN technology story 1"
    body2, result2 = await svc.get_news("IN", "technology")
    assert result2 == "hit" and provider.calls == 1 and body2 == body


async def test_stale_hit_returns_at_once_and_refreshes_in_background(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    svc = make_service(settings, clock, provider)
    await svc.get_news("IN", "nature")
    clock.advance(45 * MIN)

    provider.gate = asyncio.Event()  # the refresh blocks; the reader must not
    body, result = await asyncio.wait_for(svc.get_news("IN", "nature"), 1)
    assert result == "stale" and body.articles[0].title.endswith("story 1")
    await settle()
    assert provider.calls == 2  # refresh started, still blocked
    _, result = await asyncio.wait_for(svc.get_news("IN", "nature"), 1)
    assert result == "stale" and provider.calls == 2  # no second refresh while one is in flight

    provider.gate.set()
    await settle()
    body, result = await svc.get_news("IN", "nature")
    assert result == "hit" and body.articles[0].title.endswith("story 2")


async def test_failed_refresh_keeps_stale_copy(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    svc = make_service(settings, clock, provider)
    await svc.get_news("US", "society")
    clock.advance(2 * HOUR)
    provider.fail = True
    _, result = await svc.get_news("US", "society")
    await settle()
    body, result2 = await svc.get_news("US", "society")
    assert result == "stale" and result2 == "stale"
    assert body.articles[0].title.endswith("story 1")


async def test_expired_entry_with_failing_feed_is_unavailable(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    svc = make_service(settings, clock, provider)
    await svc.get_news("US", "society")
    clock.advance(7 * HOUR)
    provider.fail = True
    with pytest.raises(UpstreamUnavailable):
        await svc.get_news("US", "society")


async def test_empty_result_is_cached_for_five_minutes(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    provider.empty = True
    svc = make_service(settings, clock, provider)
    body, _ = await svc.get_news("BT", "technology")
    assert body.articles == []
    for _ in range(10):
        await svc.get_news("BT", "technology")
    assert provider.calls == 1
    clock.advance(6 * MIN)
    _, result = await svc.get_news("BT", "technology")
    await settle()
    assert result == "stale" and provider.calls == 2


async def test_single_flight_50_concurrent_misses_make_one_feed_call(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    provider.gate = asyncio.Event()
    svc = make_service(settings, clock, provider)
    tasks = [asyncio.create_task(svc.get_news("IN", "technology")) for _ in range(50)]
    await settle()
    provider.gate.set()
    results = await asyncio.gather(*tasks)
    assert provider.calls == 1
    assert all(r[1] == "miss" for r in results)
    assert len({r[0].model_dump_json() for r in results}) == 1


async def test_cancelled_reader_does_not_cancel_shared_fetch(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    provider.gate = asyncio.Event()
    svc = make_service(settings, clock, provider)
    first = asyncio.create_task(svc.get_news("IN", "society"))
    second = asyncio.create_task(svc.get_news("IN", "society"))
    await settle()
    first.cancel()
    provider.gate.set()
    body, _ = await second
    assert provider.calls == 1 and body.articles
