"""NewsProvider: the only part of the service that knows where news comes from.

v1 reads Google News RSS. A licensed news API can replace it by implementing the same
single method, fetch(country, section) -> raw items.
"""

import asyncio
import logging
import time
from typing import Protocol
from urllib.parse import quote, urlencode, urlsplit

import feedparser
import httpx

from .catalog import Catalog
from .config import Settings
from .errors import FeedError
from .metrics import FEED_DURATION
from .normalizer import RawItem

log = logging.getLogger("news.provider")


class NewsProvider(Protocol):
    async def fetch(self, country: str, section: str) -> list[RawItem]: ...


# --- step 1: build the request -----------------------------------------------------------


def build_feed_url(catalog: Catalog, settings: Settings, country: str, section: str) -> str:
    """Build the feed URL for an already-validated country and section.

    Countries with an edition get a topic feed (if the section has a topic) or a search
    feed in their edition. Others get an English search feed that names the country.
    Keywords come from configuration and are URL-encoded here.
    """
    base = settings.feed_base_url.rstrip("/")
    sec = catalog.sections[section]
    edition = catalog.editions.get(country)
    when = f" when:{settings.max_article_age_days}d"

    if edition is not None:
        params = {"hl": edition.hl, "gl": country, "ceid": f"{country}:{edition.lang}"}
        if sec.topic:
            return f"{base}/rss/headlines/section/topic/{quote(sec.topic)}?{urlencode(params)}"
        query = f"{sec.keywords}{when}"
    else:
        fc = settings.fallback_edition_country.upper()
        params = {
            "hl": settings.fallback_edition_hl,
            "gl": fc,
            "ceid": f"{fc}:{settings.fallback_edition_lang}",
        }
        name = catalog.by_code[country].name.replace('"', "")
        query = f'"{name}" AND ({sec.keywords}){when}'

    return f"{base}/rss/search?{urlencode({'q': query, **params}, quote_via=quote)}"


# --- step 3: parse -----------------------------------------------------------------------


def parse_feed(content: bytes) -> list[RawItem]:
    """Parse RSS XML into raw items. A document that is not a feed raises FeedError."""
    parsed = feedparser.parse(content)
    if not parsed.get("version"):
        reason = parsed.get("bozo_exception") or "not an RSS or Atom document"
        raise FeedError(f"invalid feed XML: {reason}")

    items: list[RawItem] = []
    for entry in parsed.entries:
        try:
            src = entry.get("source") or {}
            items.append(
                RawItem(
                    title=entry.get("title"),
                    link=entry.get("link"),
                    source=src.get("title") if isinstance(src, dict) else None,
                    source_url=src.get("href") if isinstance(src, dict) else None,
                    published=entry.get("published"),
                    description=entry.get("summary") or entry.get("description"),
                    image_url=entry_image(entry),
                )
            )
        except Exception:
            log.warning("dropping unreadable feed entry", exc_info=True)
    return items


def entry_image(entry) -> str | None:
    """First picture the item carries: media:content, media:thumbnail or an image enclosure.

    Google News RSS has none of these today; other feeds and future providers often do.
    """
    for media in entry.get("media_content") or []:
        kind = (media.get("medium") or media.get("type") or "image").lower()
        if media.get("url") and kind.startswith("image"):
            return media["url"]
    for thumb in entry.get("media_thumbnail") or []:
        if thumb.get("url"):
            return thumb["url"]
    for enc in entry.get("enclosures") or []:
        if enc.get("href") and (enc.get("type") or "").lower().startswith("image/"):
            return enc["href"]
    return None


# --- step 2: fetch -----------------------------------------------------------------------


class GoogleNewsProvider:
    def __init__(self, catalog: Catalog, settings: Settings, client: httpx.AsyncClient | None = None):
        self.catalog = catalog
        self.settings = settings
        self.allowed_host = (urlsplit(settings.feed_base_url).hostname or "").lower()
        self._client = client or make_feed_client(settings, self.allowed_host)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def fetch(self, country: str, section: str) -> list[RawItem]:
        url = build_feed_url(self.catalog, self.settings, country, section)
        body = await self._get_with_retry(url)
        return parse_feed(body)

    async def _get_with_retry(self, url: str) -> bytes:
        """GET once, then retry once after a short pause on a network error or 5xx.

        Timeouts and 4xx are not retried.
        """
        attempts = 2
        for attempt in range(1, attempts + 1):
            started = time.perf_counter()
            try:
                resp = await self._client.get(url)
            except httpx.TimeoutException as e:
                raise FeedError(f"feed timed out ({type(e).__name__})") from e
            except httpx.TransportError as e:
                if attempt < attempts:
                    await asyncio.sleep(self.settings.feed_retry_delay_ms / 1000)
                    continue
                raise FeedError(f"feed network error ({type(e).__name__})") from e
            finally:
                FEED_DURATION.observe(time.perf_counter() - started)

            if resp.status_code >= 500 and attempt < attempts:
                await asyncio.sleep(self.settings.feed_retry_delay_ms / 1000)
                continue
            if resp.status_code != 200:
                raise FeedError(f"feed returned HTTP {resp.status_code}")
            return resp.content
        raise FeedError("feed request failed")  # unreachable


def make_feed_client(settings: Settings, allowed_host: str) -> httpx.AsyncClient:
    """HTTP client with connect/read timeouts that refuses to leave the configured host.

    Google News topic URLs redirect within news.google.com, so same-host redirects are
    followed; a redirect anywhere else fails the fetch.
    """

    async def check_host(request: httpx.Request) -> None:
        if (request.url.host or "").lower() != allowed_host:
            raise FeedError(f"refusing to call non-feed host {request.url.host}")

    timeout = httpx.Timeout(
        connect=settings.feed_connect_timeout_ms / 1000,
        read=settings.feed_read_timeout_ms / 1000,
        write=settings.feed_read_timeout_ms / 1000,
        pool=settings.feed_connect_timeout_ms / 1000,
    )
    return httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
        max_redirects=3,
        headers={"User-Agent": "NewsDashboard/1.0 (+rss reader)", "Accept": "application/rss+xml, application/xml"},
        event_hooks={"request": [check_host]},
    )
