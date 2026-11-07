"""Service settings. Every value has a default and can be overridden by an environment variable."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DATA_DIR = Path(__file__).parent / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Cache
    cache_fresh_minutes: float = 30
    cache_stale_hours: float = 6
    cache_max_entries: int = 1000
    empty_result_ttl_minutes: float = 5

    # Pre-warm scheduler
    prewarm_countries: str = "IN,US,CA"
    prewarm_interval_minutes: float = 30
    prewarm_pause_seconds: float = 1

    # Feed
    feed_base_url: str = "https://news.google.com"
    feed_connect_timeout_ms: int = 3000
    feed_read_timeout_ms: int = 5000
    feed_retry_delay_ms: int = 500
    fallback_edition_country: str = "US"
    fallback_edition_hl: str = "en-US"
    fallback_edition_lang: str = "en"

    # Normalizer
    max_article_age_days: int = 7
    max_articles: int = 30
    summary_max_chars: int = 200

    # Circuit breaker
    breaker_failure_threshold: int = 5
    breaker_open_seconds: float = 120

    # API
    rate_limit_per_minute: int = 60
    allowed_origin: str | None = None

    # Headers a CDN or host sets to the visitor's ISO country, checked in order by /api/geo.
    # Cloudflare, CloudFront, Vercel, App Engine. Empty when running locally.
    geo_country_headers: str = "CF-IPCountry,CloudFront-Viewer-Country,X-Vercel-IP-Country,X-AppEngine-Country"

    # Optional MySQL history, e.g. mysql+pymysql://user:pass@host/newsdb
    db_url: str | None = None

    # Bundled configuration files
    countries_file: Path = DATA_DIR / "countries.json"
    editions_file: Path = DATA_DIR / "editions.json"
    sections_file: Path = DATA_DIR / "sections.json"

    log_level: str = "INFO"

    # Built frontend (frontend/dist). When set, the service also serves the web app, so one
    # deploy holds everything on one origin. Unset in development (Vite serves the app).
    static_dir: Path | None = None

    @property
    def prewarm_country_list(self) -> list[str]:
        return [c.strip().upper() for c in self.prewarm_countries.split(",") if c.strip()]

    @property
    def geo_header_list(self) -> list[str]:
        return [h.strip() for h in self.geo_country_headers.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
