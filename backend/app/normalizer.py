"""Turns raw feed items into the Article shape: clean, filter, deduplicate, sort, cap.

Each step is a small pure function so it can be tested alone.
"""

import hashlib
import html
import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .models import Article, iso_utc, to_utc

log = logging.getLogger("news.normalizer")

FUTURE_SKEW = timedelta(minutes=5)
_TAG = re.compile(r"<[^>]*>")
_WS = re.compile(r"\s+")
_NON_ALNUM = re.compile(r"[\W_]+", re.UNICODE)
_TRACKING_PARAMS = {"oc", "fbclid", "gclid", "mc_cid", "mc_eid", "ref"}


@dataclass
class RawItem:
    """One feed item as the provider found it. Every field may be missing."""

    title: str | None = None
    link: str | None = None
    source: str | None = None
    source_url: str | None = None
    published: str | None = None
    description: str | None = None
    image_url: str | None = None


@dataclass
class _Candidate:
    article: Article
    published: datetime
    canonical: str
    title_key: str


# --- small steps -------------------------------------------------------------------------


def clean_text(value: str | None) -> str:
    """Decode HTML entities, strip tags and collapse whitespace (non-breaking spaces too)."""
    if not value:
        return ""
    text = value
    for _ in range(2):  # descriptions are sometimes escaped twice
        text = _TAG.sub(" ", html.unescape(text))
    return _WS.sub(" ", text.replace("\xa0", " ")).strip()


def canonical_url(url: str) -> str:
    """Lower-case scheme and host, drop the fragment and tracking parameters, sort the rest."""
    parts = urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in _TRACKING_PARAMS and not k.lower().startswith("utm_")
    ]
    path = parts.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(sorted(query)), ""))


def article_id(canonical: str) -> str:
    """First 12 hex characters of a SHA-1 of the canonical URL: the same story keeps its id."""
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:12]


def host_name(url: str | None) -> str:
    if not url:
        return ""
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


# Hosts that only redirect to the story, so they say nothing about the publisher.
_AGGREGATOR_HOSTS = {"news.google.com"}


def source_domain(source_url: str | None, link: str) -> str | None:
    """The publisher's domain, for showing its logo. None when only an aggregator host is known."""
    for candidate in (source_url, link):
        host = host_name(candidate)
        if host and host not in _AGGREGATOR_HOSTS:
            return host
    return None


def http_url(url: str | None) -> str | None:
    """The URL if it is an absolute http(s) URL, else None."""
    if not url:
        return None
    url = url.strip()
    parts = urlsplit(url)
    return url if parts.scheme in ("http", "https") and parts.hostname else None


def title_key(title: str) -> str:
    return _NON_ALNUM.sub("", title.casefold())


def strip_source_suffix(title: str, source: str) -> str:
    """Remove the trailing ' - Source name' that Google News appends."""
    if source:
        suffix = f" - {source}"
        if title.casefold().endswith(suffix.casefold()) and len(title) > len(suffix):
            return title[: -len(suffix)].rstrip()
    return title


def parse_date(value: str | None) -> datetime | None:
    """Parse an RFC 822 pubDate (or ISO 8601) and convert it to UTC."""
    if not value:
        return None
    value = value.strip()
    try:
        return to_utc(parsedate_to_datetime(value))
    except (TypeError, ValueError, IndexError):
        pass
    try:
        return to_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def make_summary(description: str | None, title: str, source: str, max_chars: int) -> str | None:
    """Plain-text summary cut to max_chars. None when empty or when it only repeats the title.

    Google News descriptions are the headline (or a list of related headlines) plus the
    source name, so any description that starts with the title is treated as a repeat.
    """
    text = clean_text(description)
    if not text:
        return None
    key = title_key(text)
    if not key or key.startswith(title_key(title)) or key == title_key(source):
        return None
    if len(text) <= max_chars:
        return text
    cut = text[: max_chars - 1]
    if " " in cut[max_chars // 2 :]:
        cut = cut[: cut.rfind(" ")]
    return cut.rstrip(" ,.;:-") + "…"


# --- pipeline ----------------------------------------------------------------------------


def to_candidate(item: RawItem, summary_max_chars: int) -> _Candidate | None:
    """Map one raw item to an Article. Returns None (and logs) when the item is unusable."""
    link = (item.link or "").strip()
    raw_title = clean_text(item.title)
    if not raw_title or not link:
        return None
    if urlsplit(link).scheme not in ("http", "https"):
        log.warning("dropping item with non-http link", extra={"link": link[:200]})
        return None
    published = parse_date(item.published)
    if published is None:
        log.warning("dropping item with missing or bad pubDate", extra={"pubDate": item.published})
        return None

    source = clean_text(item.source) or host_name(item.source_url) or host_name(link)
    title = strip_source_suffix(raw_title, source)
    canonical = canonical_url(link)
    article = Article(
        id=article_id(canonical),
        title=title,
        source=source,
        url=link,
        publishedAt=iso_utc(published),
        summary=make_summary(item.description, title, source, summary_max_chars),
        sourceDomain=source_domain(item.source_url, link),
        imageUrl=http_url(item.image_url),
    )
    return _Candidate(article=article, published=published, canonical=canonical, title_key=title_key(title))


def normalize(
    items: list[RawItem],
    *,
    now: datetime | None = None,
    max_age_days: int = 7,
    max_articles: int = 30,
    summary_max_chars: int = 200,
) -> list[Article]:
    now = to_utc(now or datetime.now(timezone.utc))
    oldest = now - timedelta(days=max_age_days)
    newest = now + FUTURE_SKEW

    candidates: list[_Candidate] = []
    for item in items:
        try:
            cand = to_candidate(item, summary_max_chars)
        except Exception:  # one bad item never fails the whole request
            log.warning("dropping malformed feed item", exc_info=True)
            continue
        if cand is None or not (oldest <= cand.published <= newest):
            continue
        candidates.append(cand)

    # Newest first, so deduplication keeps the newest copy of each story.
    candidates.sort(key=lambda c: c.published, reverse=True)
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    out: list[Article] = []
    for cand in candidates:
        if cand.canonical in seen_urls or (cand.title_key and cand.title_key in seen_titles):
            continue
        seen_urls.add(cand.canonical)
        seen_titles.add(cand.title_key)
        out.append(cand.article)
        if len(out) >= max_articles:
            break
    return out
