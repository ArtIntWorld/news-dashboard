"""Optional MySQL history: article history and a feed-health log.

Enabled only when DB_URL is set. Requests are always answered from the cache, so every
write here runs in the background and a database failure is logged, never raised.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from .models import Article, Country

log = logging.getLogger("news.history")


class History:
    async def sync_countries(self, countries: list[Country], editions: dict) -> None: ...
    async def record_fetch(self, country, section, started_at, duration_ms, status, item_count, error) -> None: ...
    async def record_articles(self, country: str, section: str, articles: list[Article], seen_at: datetime) -> None: ...
    async def create_schema(self) -> None: ...
    async def cleanup(self) -> None: ...
    async def aclose(self) -> None: ...


class NullHistory(History):
    """Used when no database is configured: every call is a no-op."""


def _naive_utc(dt: datetime) -> datetime:
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


class SqlHistory(History):
    ARTICLE_RETENTION = timedelta(days=30)
    FETCH_LOG_RETENTION = timedelta(days=14)

    def __init__(self, db_url: str):
        import sqlalchemy as sa

        self.sa = sa
        self.engine = sa.create_engine(db_url, pool_pre_ping=True, pool_recycle=3600)
        md = sa.MetaData()
        sections = sa.Enum("nature", "society", "technology", name="section")
        self.country = sa.Table(
            "country", md,
            sa.Column("code", sa.CHAR(2), primary_key=True),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("lang", sa.String(10), nullable=True),
            sa.Column("has_edition", sa.Boolean, nullable=False, server_default=sa.false()),
        )
        self.article = sa.Table(
            "article", md,
            sa.Column("country_code", sa.CHAR(2), sa.ForeignKey("country.code", name="fk_article_country"), primary_key=True),
            sa.Column("section", sections, primary_key=True),
            sa.Column("id", sa.CHAR(12), primary_key=True),  # PK order matches the design: (country_code, section, id)
            sa.Column("title", sa.String(500), nullable=False),
            sa.Column("source", sa.String(200), nullable=False),
            sa.Column("url", sa.String(2048), nullable=False),
            sa.Column("summary", sa.String(300), nullable=True),
            sa.Column("published_at", sa.DateTime, nullable=False),
            sa.Column("first_seen_at", sa.DateTime, nullable=False),
            sa.Column("last_seen_at", sa.DateTime, nullable=False),
            sa.Index("idx_article_view", "country_code", "section", "published_at"),
        )
        self.fetch_log = sa.Table(
            "fetch_log", md,
            sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
            sa.Column("country_code", sa.CHAR(2), nullable=False),
            sa.Column("section", sections, nullable=False),
            sa.Column("started_at", sa.DateTime, nullable=False),
            sa.Column("duration_ms", sa.Integer, nullable=False),
            sa.Column("status", sa.Enum("ok", "empty", "error", name="fetch_status"), nullable=False),
            sa.Column("item_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("error_message", sa.String(500), nullable=True),
            sa.Index("idx_fetch_log_view", "country_code", "section", "started_at"),
        )
        self.metadata = md

    async def _run(self, what: str, fn) -> None:
        try:
            await asyncio.to_thread(fn)
        except Exception:
            log.warning("history write failed: %s", what, exc_info=True)

    async def create_schema(self) -> None:
        await self._run("create schema", lambda: self.metadata.create_all(self.engine, checkfirst=True))

    async def sync_countries(self, countries: list[Country], editions: dict) -> None:
        from sqlalchemy.dialects.mysql import insert

        rows = [
            {
                "code": c.code,
                "name": c.name[:100],
                "lang": editions[c.code].lang[:10] if c.code in editions else None,
                "has_edition": c.code in editions,
            }
            for c in countries
        ]

        def work():
            stmt = insert(self.country)
            stmt = stmt.on_duplicate_key_update(
                name=stmt.inserted.name, lang=stmt.inserted.lang, has_edition=stmt.inserted.has_edition
            )
            with self.engine.begin() as conn:
                conn.execute(stmt, rows)

        await self._run("country upsert", work)

    async def record_fetch(self, country, section, started_at, duration_ms, status, item_count, error) -> None:
        row = {
            "country_code": country,
            "section": section,
            "started_at": _naive_utc(started_at),
            "duration_ms": duration_ms,
            "status": status,
            "item_count": item_count,
            "error_message": (error or None) and error[:500],
        }

        def work():
            with self.engine.begin() as conn:
                conn.execute(self.fetch_log.insert(), row)

        await self._run("fetch_log insert", work)

    async def record_articles(self, country: str, section: str, articles: list[Article], seen_at: datetime) -> None:
        from sqlalchemy.dialects.mysql import insert

        seen = _naive_utc(seen_at)
        rows = [
            {
                "id": a.id,
                "country_code": country,
                "section": section,
                "title": a.title[:500],
                "source": a.source[:200],
                "url": a.url[:2048],
                "summary": a.summary[:300] if a.summary else None,
                "published_at": _naive_utc(datetime.fromisoformat(a.publishedAt.replace("Z", "+00:00"))),
                "first_seen_at": seen,
                "last_seen_at": seen,
            }
            for a in articles
        ]

        def work():
            stmt = insert(self.article)
            stmt = stmt.on_duplicate_key_update(last_seen_at=stmt.inserted.last_seen_at)
            with self.engine.begin() as conn:
                conn.execute(stmt, rows)

        await self._run("article upsert", work)

    async def cleanup(self) -> None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        def work():
            with self.engine.begin() as conn:
                a = conn.execute(self.article.delete().where(self.article.c.published_at < now - self.ARTICLE_RETENTION))
                f = conn.execute(
                    self.fetch_log.delete().where(self.fetch_log.c.started_at < now - self.FETCH_LOG_RETENTION)
                )
                log.info("history cleanup", extra={"articles_deleted": a.rowcount, "fetch_logs_deleted": f.rowcount})

        await self._run("nightly cleanup", work)

    async def aclose(self) -> None:
        await asyncio.to_thread(self.engine.dispose)


def make_history(db_url: str | None) -> History:
    if not db_url:
        return NullHistory()
    return SqlHistory(db_url)
