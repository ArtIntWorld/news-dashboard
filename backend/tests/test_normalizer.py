import pytest

from app.errors import FeedError
from app.normalizer import (
    RawItem,
    article_id,
    canonical_url,
    clean_text,
    make_summary,
    normalize,
    strip_source_suffix,
)
from app.provider import parse_feed
from conftest import NOW


@pytest.fixture
def articles(sample_feed):
    return normalize(parse_feed(sample_feed), now=NOW)


def by_title(articles, prefix):
    return next(a for a in articles if a.title.startswith(prefix))


def test_sample_feed_keeps_only_valid_unique_recent_items(articles):
    assert [a.title for a in articles] == [
        "Startups bet on \"quantum\" sensors",  # 11:15Z (16:45 +0530)
        "Chip maker opens new plant in Pune",  # 10:15Z
        "Open-source model tops coding benchmark",  # 08:00Z
    ]


def test_sorted_newest_first(articles):
    stamps = [a.publishedAt for a in articles]
    assert stamps == sorted(stamps, reverse=True)


def test_title_suffix_removed_and_source_kept(articles):
    a = by_title(articles, "Chip maker")
    assert a.title == "Chip maker opens new plant in Pune"
    assert a.source == "The Tech Daily"


def test_summary_left_out_when_it_repeats_the_title(articles):
    assert by_title(articles, "Chip maker").summary is None


def test_html_and_entities_cleaned_in_summary_and_title(articles):
    a = by_title(articles, "Startups")
    assert a.title == 'Startups bet on "quantum" sensors'
    assert a.summary == "Investors poured $2 billion into & around sensor startups this year."


def test_published_at_converted_to_utc(articles):
    assert by_title(articles, "Startups").publishedAt == "2026-11-07T11:15:00Z"


def test_missing_source_falls_back_to_host(articles):
    assert by_title(articles, "Open-source").source == "codenews.example"


def test_url_kept_as_given_and_id_stable(articles):
    a = by_title(articles, "Chip maker")
    assert a.url == "https://news.google.com/rss/articles/AAA111?oc=5"
    assert a.id == article_id(canonical_url(a.url))
    assert len(a.id) == 12


def test_dedupe_keeps_newest_copy():
    items = [
        RawItem(title="Same story - A", link="https://a.example/1", source="A", published="Sat, 07 Nov 2026 09:00:00 GMT"),
        RawItem(title="Same story - B", link="https://b.example/2", source="B", published="Sat, 07 Nov 2026 12:00:00 GMT"),
    ]
    out = normalize(items, now=NOW)
    assert len(out) == 1 and out[0].source == "B"


def test_cap_at_max_articles():
    items = [
        RawItem(title=f"Story {i}", link=f"https://x.example/{i}", published=f"Sat, 07 Nov 2026 {i % 12:02d}:{i % 60:02d}:00 GMT")
        for i in range(50)
    ]
    assert len(normalize(items, now=NOW)) == 30
    assert len(normalize(items, now=NOW, max_articles=5)) == 5


def test_malformed_item_is_dropped_not_fatal():
    class Exploding:
        link = "https://ok.example/boom"

        @property
        def title(self):
            raise ValueError("boom")

    good = RawItem(title="Fine", link="https://ok.example/1", published="Sat, 07 Nov 2026 09:00:00 GMT")
    out = normalize([Exploding(), good], now=NOW)  # type: ignore[list-item]
    assert [a.title for a in out] == ["Fine"]


def test_non_http_links_dropped():
    item = RawItem(title="X", link="javascript:alert(1)", published="Sat, 07 Nov 2026 09:00:00 GMT")
    assert normalize([item], now=NOW) == []


def test_invalid_xml_is_a_failed_fetch():
    with pytest.raises(FeedError):
        parse_feed(b"<html><body>Sorry, unusual traffic</body></html>")
    with pytest.raises(FeedError):
        parse_feed(b"not xml at all")


def test_empty_valid_feed_gives_no_items():
    assert parse_feed(b'<?xml version="1.0"?><rss version="2.0"><channel><title>x</title></channel></rss>') == []


def test_helpers():
    assert clean_text("  a&nbsp;&amp;<b>b</b>\n c ") == "a & b c"
    assert strip_source_suffix("Hello - BBC News", "BBC News") == "Hello"
    assert strip_source_suffix("Hello - BBC", "Reuters") == "Hello - BBC"
    assert canonical_url("HTTPS://Ex.COM/a/?utm_source=x&b=2&a=1#f") == "https://ex.com/a?a=1&b=2"
    long = "word " * 100
    s = make_summary(long, "Title", "Src", 200)
    assert s is not None and len(s) <= 200 and s.endswith("…")


def test_source_domain_skips_google_redirect_host(articles):
    assert by_title(articles, "Chip maker").sourceDomain == "techdaily.example"  # from <source url>
    assert by_title(articles, "Open-source").sourceDomain == "codenews.example"  # from the link


def test_images_read_from_media_tags():
    feed = b"""<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>t</title>
<item><title>With media</title><link>https://a.example/1</link><pubDate>Sat, 07 Nov 2026 09:00:00 GMT</pubDate>
<media:content url="https://img.example/1.jpg" medium="image"/></item>
<item><title>With thumbnail</title><link>https://a.example/2</link><pubDate>Sat, 07 Nov 2026 08:00:00 GMT</pubDate>
<media:thumbnail url="https://img.example/2.jpg"/></item>
<item><title>With enclosure</title><link>https://a.example/3</link><pubDate>Sat, 07 Nov 2026 07:00:00 GMT</pubDate>
<enclosure url="https://img.example/3.png" type="image/png" length="1"/></item>
<item><title>Unsafe image</title><link>https://a.example/4</link><pubDate>Sat, 07 Nov 2026 06:00:00 GMT</pubDate>
<media:thumbnail url="javascript:alert(1)"/></item>
<item><title>No image</title><link>https://a.example/5</link><pubDate>Sat, 07 Nov 2026 05:00:00 GMT</pubDate></item>
</channel></rss>"""
    out = normalize(parse_feed(feed), now=NOW)
    assert [a.imageUrl for a in out] == [
        "https://img.example/1.jpg",
        "https://img.example/2.jpg",
        "https://img.example/3.png",
        None,
        None,
    ]
