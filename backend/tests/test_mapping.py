from urllib.parse import parse_qs, urlsplit

import pytest

from app.catalog import ConfigError, load_countries
from app.provider import build_feed_url


def q(url):
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


def test_technology_uses_topic_feed_in_edition(catalog, settings):
    url = build_feed_url(catalog, settings, "IN", "technology")
    assert url.startswith("https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?")
    assert q(url) == {"hl": "en-IN", "gl": "IN", "ceid": "IN:en"}


@pytest.mark.parametrize(
    "section,word", [("nature", "biodiversity"), ("society", "education")]
)
def test_keyword_sections_use_search_feed(catalog, settings, section, word):
    url = build_feed_url(catalog, settings, "US", section)
    assert url.startswith("https://news.google.com/rss/search?")
    params = q(url)
    assert word in params["q"] and params["q"].endswith(" when:7d")
    assert params["ceid"] == "US:en"


def test_non_english_edition(catalog, settings):
    params = q(build_feed_url(catalog, settings, "BR", "technology"))
    assert params == {"hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}


@pytest.mark.parametrize("section", ["technology", "nature", "society"])
def test_country_without_edition_falls_back_to_english_search(catalog, settings, section):
    url = build_feed_url(catalog, settings, "BT", section)
    assert url.startswith("https://news.google.com/rss/search?")
    params = q(url)
    assert params["q"].startswith('"Bhutan" AND (') and params["q"].endswith(") when:7d")
    assert params["ceid"] == "US:en" and params["gl"] == "US"


def test_query_is_url_encoded(catalog, settings):
    url = build_feed_url(catalog, settings, "BT", "nature")
    raw_query = urlsplit(url).query
    assert " " not in raw_query and '"' not in raw_query and "(" not in raw_query


def test_every_country_and_section_builds_a_feed_url_on_the_feed_host(catalog, settings):
    for c in catalog.countries:
        for s in ("nature", "society", "technology"):
            assert urlsplit(build_feed_url(catalog, settings, c.code, s)).hostname == "news.google.com"


def test_bad_country_file_fails_fast(tmp_path):
    bad = tmp_path / "countries.json"
    bad.write_text("[]")
    with pytest.raises(ConfigError):
        load_countries(bad)
    bad.write_text('[{"code": "USA", "name": "x"}]')
    with pytest.raises(ConfigError):
        load_countries(bad)
    with pytest.raises(ConfigError):
        load_countries(tmp_path / "missing.json")


def test_country_list_sorted_by_name(catalog):
    names = [c.name.casefold() for c in catalog.countries]
    assert names == sorted(names)
    assert len(catalog.countries) > 240
