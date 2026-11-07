"""The API shapes shared with the frontend (see frontend src/api/types.ts)."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel

Section = Literal["nature", "society", "technology"]
SECTIONS: tuple[str, ...] = ("nature", "society", "technology")


class Country(BaseModel):
    code: str
    name: str


class Article(BaseModel):
    id: str
    title: str
    source: str
    url: str
    publishedAt: str  # ISO 8601, UTC
    summary: str | None = None
    sourceDomain: str | None = None  # publisher's site, e.g. "techradar.com", for its logo
    imageUrl: str | None = None  # story picture, when the feed provides one


class NewsResponse(BaseModel):
    country: str
    section: Section
    fetchedAt: str
    articles: list[Article]


def to_utc(dt: datetime) -> datetime:
    """Return an aware UTC datetime. Naive values are taken to be UTC already."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso_utc(dt: datetime) -> str:
    """Format as ISO 8601 UTC to the second, e.g. 2026-11-07T13:30:00Z."""
    return to_utc(dt).strftime("%Y-%m-%dT%H:%M:%SZ")
