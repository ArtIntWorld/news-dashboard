import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from conftest import FakeClock, FakeProvider


@pytest.fixture
def provider():
    return FakeProvider(FakeClock())


@pytest.fixture
def client(settings, provider):
    app = create_app(settings, provider=provider, clock=provider.clock, start_jobs=False)
    with TestClient(app) as c:
        yield c


def assert_error(resp, status, code):
    assert resp.status_code == status
    body = resp.json()
    assert set(body) == {"error"} and set(body["error"]) == {"code", "message"}
    assert body["error"]["code"] == code
    assert "Traceback" not in resp.text and "news.google.com" not in resp.text


def test_health_and_ready(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/api/ready").status_code == 200


def test_countries(client):
    r = client.get("/api/countries")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=86400"
    data = r.json()
    assert {"code": "IN", "name": "India"} in data
    names = [c["name"].casefold() for c in data]
    assert names == sorted(names)


def test_news_ok(client, provider):
    r = client.get("/api/news", params={"country": "in", "section": "technology"})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=300"
    body = r.json()
    assert body["country"] == "IN" and body["section"] == "technology"
    assert body["fetchedAt"] == "2026-11-07T14:00:00Z"
    art = body["articles"][0]
    assert set(art) == {"id", "title", "source", "url", "publishedAt", "summary", "sourceDomain"}
    assert art["sourceDomain"] == "fake.example"
    assert "imageUrl" not in art  # left out when the feed has no picture
    assert art["title"] == "IN technology story 1"

    client.get("/api/news", params={"country": "IN", "section": "technology"})
    assert provider.calls == 1


def test_summary_omitted_when_absent(client, provider):
    provider_desc = FakeProvider.fetch

    async def no_summary(self, country, section):
        items = await provider_desc(self, country, section)
        for i in items:
            i.description = None
        return items

    FakeProvider.fetch = no_summary  # type: ignore[method-assign]
    try:
        art = client.get("/api/news", params={"country": "US", "section": "nature"}).json()["articles"][0]
    finally:
        FakeProvider.fetch = provider_desc  # type: ignore[method-assign]
    assert "summary" not in art


def test_empty_country_is_200_with_empty_list(client, provider):
    provider.empty = True
    r = client.get("/api/news", params={"country": "BT", "section": "nature"})
    assert r.status_code == 200 and r.json()["articles"] == []


@pytest.mark.parametrize(
    "params,code",
    [
        ({"section": "nature"}, "invalid_country"),
        ({"country": "", "section": "nature"}, "invalid_country"),
        ({"country": "XX", "section": "nature"}, "invalid_country"),
        ({"country": "IND", "section": "nature"}, "invalid_country"),
        ({"country": "IN"}, "invalid_section"),
        ({"country": "IN", "section": "sports"}, "invalid_section"),
        ({"country": "IN", "section": "Nature"}, "invalid_section"),
    ],
)
def test_validation_errors(client, provider, params, code):
    assert_error(client.get("/api/news", params=params), 400, code)
    assert provider.calls == 0


def test_502_when_feed_fails_and_nothing_cached(client, provider):
    provider.fail = True
    r = client.get("/api/news", params={"country": "IN", "section": "society"})
    assert_error(r, 502, "upstream_unavailable")
    assert r.headers["cache-control"] == "no-store"


def test_rate_limit(settings, provider):
    settings.rate_limit_per_minute = 3
    app = create_app(settings, provider=provider, clock=provider.clock, start_jobs=False)
    with TestClient(app) as c:
        for _ in range(3):
            assert c.get("/api/news", params={"country": "IN", "section": "nature"}).status_code == 200
        r = c.get("/api/news", params={"country": "IN", "section": "nature"})
        assert_error(r, 429, "rate_limited")
        assert int(r.headers["retry-after"]) >= 1
        # other endpoints are not limited
        assert c.get("/api/countries").status_code == 200


def test_unknown_route_uses_error_shape(client):
    assert_error(client.get("/api/nope"), 404, "not_found")


def test_unexpected_error_is_500_without_details(settings):
    class Broken:
        async def fetch(self, country, section):
            raise RuntimeError("secret internals")

    app = create_app(settings, provider=Broken(), start_jobs=False)
    # A non-FeedError from the provider is still treated as a failed fetch.
    with TestClient(app) as c:
        r = c.get("/api/news", params={"country": "IN", "section": "nature"})
        assert_error(r, 502, "upstream_unavailable")
        assert "secret" not in r.text

    app2 = create_app(settings, provider=FakeProvider(), start_jobs=False)

    async def boom(*_a, **_k):
        raise RuntimeError("secret internals")

    app2.state.service.get_news = boom
    with TestClient(app2, raise_server_exceptions=False) as c:
        r = c.get("/api/news", params={"country": "IN", "section": "nature"})
        assert_error(r, 500, "internal_error")
        assert "secret" not in r.text


def test_cors_only_when_origin_configured(settings, provider):
    settings.allowed_origin = "https://news.example"
    app = create_app(settings, provider=provider, clock=provider.clock, start_jobs=False)
    with TestClient(app) as c:
        ok = c.get("/api/countries", headers={"Origin": "https://news.example"})
        assert ok.headers["access-control-allow-origin"] == "https://news.example"
        other = c.get("/api/countries", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in other.headers


def test_no_cors_by_default(client):
    r = client.get("/api/countries", headers={"Origin": "http://localhost:5173"})
    assert "access-control-allow-origin" not in r.headers


def test_metrics_exposed(client):
    client.get("/api/news", params={"country": "IN", "section": "nature"})
    text = client.get("/metrics").text
    assert "news_cache_results_total" in text and "news_http_requests_total" in text


def test_geo_null_when_no_cdn_header(client):
    r = client.get("/api/geo")
    assert r.status_code == 200 and r.json() == {"country": None}
    assert r.headers["cache-control"] == "private, no-store"


@pytest.mark.parametrize(
    "headers,expected",
    [
        ({"CF-IPCountry": "in"}, "IN"),
        ({"CloudFront-Viewer-Country": "DE"}, "DE"),
        ({"CF-IPCountry": "XX", "X-Vercel-IP-Country": "BR"}, "BR"),  # XX = unknown, skipped
        ({"CF-IPCountry": "T1"}, None),  # Tor
    ],
)
def test_geo_reads_cdn_header(client, headers, expected):
    assert client.get("/api/geo", headers=headers).json() == {"country": expected}


@pytest.fixture
def web_client(settings, provider, tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>app</title>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    settings.static_dir = tmp_path
    app = create_app(settings, provider=provider, clock=provider.clock, start_jobs=False)
    with TestClient(app) as c:
        yield c


def test_serves_frontend_with_page_fallback(web_client):
    for page in ("/", "/explore", "/saved"):
        r = web_client.get(page)
        assert r.status_code == 200 and "<title>app</title>" in r.text
        assert r.headers["cache-control"] == "no-cache"
    asset = web_client.get("/assets/app-abc123.js")
    assert asset.status_code == 200 and "immutable" in asset.headers["cache-control"]
    assert web_client.get("/favicon.svg").status_code == 200


def test_frontend_never_shadows_the_api(web_client):
    assert web_client.get("/api/health").json() == {"status": "ok"}
    assert_error(web_client.get("/api/nope"), 404, "not_found")
    assert web_client.get("/api/news", params={"country": "IN", "section": "nature"}).status_code == 200


def test_frontend_missing_files_and_traversal(web_client):
    assert web_client.get("/assets/missing.js").status_code == 404
    r = web_client.get("/%2e%2e/%2e%2e/app/config.py")
    assert r.status_code == 404 or "<title>app</title>" in r.text
    assert "BaseSettings" not in r.text
