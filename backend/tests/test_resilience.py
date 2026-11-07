import httpx
import pytest
import respx

from app.breaker import CircuitBreaker
from app.cache import NewsCache
from app.errors import BreakerOpen, FeedError, UpstreamUnavailable
from app.provider import GoogleNewsProvider
from app.service import NewsService
from conftest import FakeClock, FakeProvider

FEED = "https://news.google.com/rss/"


@pytest.fixture
def fast_settings(settings):
    settings.feed_retry_delay_ms = 1
    return settings


@pytest.fixture
async def provider(catalog, fast_settings):
    p = GoogleNewsProvider(catalog, fast_settings)
    yield p
    await p.aclose()


@respx.mock
async def test_fetch_ok(provider, sample_feed):
    route = respx.get(url__startswith=FEED).respond(200, content=sample_feed)
    items = await provider.fetch("IN", "technology")
    assert len(items) == 10 and route.call_count == 1


@respx.mock
async def test_timeout_is_a_failed_fetch_without_retry(provider):
    route = respx.get(url__startswith=FEED).mock(side_effect=httpx.ReadTimeout("slow"))
    with pytest.raises(FeedError, match="timed out"):
        await provider.fetch("IN", "technology")
    assert route.call_count == 1


@respx.mock
async def test_5xx_is_retried_once_then_succeeds(provider, sample_feed):
    route = respx.get(url__startswith=FEED).mock(
        side_effect=[httpx.Response(503), httpx.Response(200, content=sample_feed)]
    )
    assert await provider.fetch("IN", "nature")
    assert route.call_count == 2


@respx.mock
async def test_5xx_twice_fails(provider):
    route = respx.get(url__startswith=FEED).respond(500)
    with pytest.raises(FeedError, match="HTTP 500"):
        await provider.fetch("IN", "nature")
    assert route.call_count == 2


@respx.mock
async def test_network_error_is_retried_once(provider, sample_feed):
    route = respx.get(url__startswith=FEED).mock(
        side_effect=[httpx.ConnectError("reset"), httpx.Response(200, content=sample_feed)]
    )
    assert await provider.fetch("US", "society")
    assert route.call_count == 2


@respx.mock
async def test_4xx_is_not_retried(provider):
    route = respx.get(url__startswith=FEED).respond(429)
    with pytest.raises(FeedError, match="HTTP 429"):
        await provider.fetch("US", "society")
    assert route.call_count == 1


@respx.mock
async def test_bad_xml_is_a_failed_fetch(provider):
    respx.get(url__startswith=FEED).respond(200, content=b"<html>captcha</html>")
    with pytest.raises(FeedError):
        await provider.fetch("US", "society")


@respx.mock
async def test_empty_feed_returns_no_items(provider):
    respx.get(url__startswith=FEED).respond(
        200, content=b'<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>'
    )
    assert await provider.fetch("BT", "nature") == []


@respx.mock
async def test_redirect_off_the_feed_host_is_refused(provider):
    respx.get(url__startswith=FEED).respond(302, headers={"Location": "https://evil.example/rss"})
    evil = respx.get(url__startswith="https://evil.example").respond(200, content=b"<rss/>")
    with pytest.raises(FeedError):
        await provider.fetch("IN", "technology")
    assert evil.call_count == 0


@respx.mock
async def test_same_host_redirect_is_followed(provider, sample_feed):
    respx.get(url__startswith=FEED + "headlines").respond(
        302, headers={"Location": "https://news.google.com/rss/topics/ABC?hl=en-IN"}
    )
    respx.get(url__startswith=FEED + "topics").respond(200, content=sample_feed)
    assert len(await provider.fetch("IN", "technology")) == 10


# --- circuit breaker -------------------------------------------------------------------


def test_breaker_opens_after_threshold_and_closes_after_pause():
    clock = FakeClock(0)
    b = CircuitBreaker(5, 120, clock=clock)
    for _ in range(4):
        b.record_failure()
    assert b.allow()
    b.record_failure()
    assert b.is_open and not b.allow()
    clock.advance(121)
    assert b.allow()  # one trial call
    assert not b.allow()  # only one at a time
    b.record_success()
    assert not b.is_open and b.allow()


def test_breaker_reopens_when_trial_fails():
    clock = FakeClock(0)
    b = CircuitBreaker(5, 120, clock=clock)
    for _ in range(5):
        b.record_failure()
    clock.advance(121)
    assert b.allow()
    b.record_failure()
    assert b.is_open


async def test_service_stops_calling_feed_while_breaker_is_open(settings):
    clock = FakeClock()
    provider = FakeProvider(clock)
    provider.fail = True
    breaker_clock = FakeClock(0)
    svc = NewsService(
        provider,
        NewsCache(1800, 21600, 300, 1000, clock),
        CircuitBreaker(5, 120, clock=breaker_clock),
        settings,
    )
    for i in range(5):
        with pytest.raises(UpstreamUnavailable):
            await svc.get_news("FR", "nature" if i % 2 else "society")
    assert provider.calls == 5
    with pytest.raises(UpstreamUnavailable) as exc:
        await svc.get_news("FR", "technology")
    assert isinstance(exc.value.__cause__, BreakerOpen)
    assert provider.calls == 5  # paused

    breaker_clock.advance(121)
    provider.fail = False
    body, _ = await svc.get_news("FR", "technology")
    assert body.articles and provider.calls == 6
