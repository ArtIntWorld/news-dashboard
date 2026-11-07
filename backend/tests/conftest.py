import asyncio
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.catalog import load_catalog
from app.config import Settings
from app.errors import FeedError
from app.normalizer import RawItem

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 11, 7, 14, 0, tzinfo=timezone.utc)


class FakeClock:
    def __init__(self, start: float = NOW.timestamp()):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class FakeProvider:
    """Stands in for the feed. Counts calls; can fail, return nothing, or block until released."""

    def __init__(self, clock: FakeClock | None = None):
        self.calls = 0
        self.fail = False
        self.empty = False
        self.gate: asyncio.Event | None = None
        self.clock = clock

    async def fetch(self, country: str, section: str) -> list[RawItem]:
        self.calls += 1
        if self.gate is not None:
            await self.gate.wait()
        if self.fail:
            raise FeedError("fake feed down")
        if self.empty:
            return []
        when = datetime.fromtimestamp(self.clock(), timezone.utc) if self.clock else NOW
        return [
            RawItem(
                title=f"{country} {section} story {self.calls} - Fake Source",
                link=f"https://fake.example/{country}/{section}/{self.calls}",
                source="Fake Source",
                published=when.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                description="A short summary of the story.",
            )
        ]


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, prewarm_countries="", db_url=None, allowed_origin=None)


@pytest.fixture
def catalog(settings):
    return load_catalog(settings.countries_file, settings.editions_file, settings.sections_file)


@pytest.fixture
def sample_feed() -> bytes:
    return (FIXTURES / "google_news_sample.xml").read_bytes()
