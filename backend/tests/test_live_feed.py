"""Optional live check against the real feed, to catch it changing format.

Skipped by default. Run by hand or nightly:  pytest -m live
"""

import pytest

from app.normalizer import normalize
from app.provider import GoogleNewsProvider


@pytest.mark.live
@pytest.mark.parametrize("country,section", [("US", "technology"), ("IN", "nature"), ("GB", "society"), ("BT", "society")])
async def test_live_feed(catalog, settings, country, section):
    provider = GoogleNewsProvider(catalog, settings)
    try:
        raw = await provider.fetch(country, section)
    finally:
        await provider.aclose()
    articles = normalize(raw)
    assert raw, "feed returned no items"
    assert articles, "no items survived normalization"
    assert all(a.title and a.url.startswith("http") and a.publishedAt.endswith("Z") for a in articles)
