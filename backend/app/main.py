"""REST API: validates input, calls NewsService, shapes JSON and error responses."""

import asyncio
import contextlib
import json
import logging
import time
from collections.abc import Callable
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.exceptions import HTTPException as StarletteHTTPException

from .breaker import CircuitBreaker
from .cache import NewsCache
from .catalog import ConfigError, load_catalog
from .config import Settings, get_settings
from .errors import ApiError, UpstreamUnavailable
from .history import make_history
from .metrics import REQUEST_DURATION, REQUESTS
from .models import SECTIONS
from .provider import GoogleNewsProvider, NewsProvider
from .ratelimit import RateLimiter
from .scheduler import nightly_cleanup_loop, prewarm_loop
from .service import NewsService

log = logging.getLogger("news.api")

COUNTRIES_CACHE_CONTROL = "public, max-age=86400"
NEWS_CACHE_CONTROL = "public, max-age=300"
_ROUTES = {"/api/news", "/api/countries", "/api/geo", "/api/health", "/api/ready", "/metrics"}


def error_response(err: ApiError) -> JSONResponse:
    return JSONResponse(err.body(), status_code=err.status, headers={"Cache-Control": "no-store", **err.headers})


def create_app(
    settings: Settings | None = None,
    provider: NewsProvider | None = None,
    clock: Callable[[], float] = time.time,
    start_jobs: bool = True,
) -> FastAPI:
    settings = settings or get_settings()
    # Fail fast with a clear message rather than start with an empty country list.
    catalog = load_catalog(settings.countries_file, settings.editions_file, settings.sections_file)
    countries_body = json.dumps([c.model_dump() for c in catalog.countries], ensure_ascii=False).encode()

    owns_provider = provider is None
    provider = provider or GoogleNewsProvider(catalog, settings)
    service = NewsService(
        provider=provider,
        cache=NewsCache(
            fresh_seconds=settings.cache_fresh_minutes * 60,
            stale_seconds=settings.cache_stale_hours * 3600,
            empty_fresh_seconds=settings.empty_result_ttl_minutes * 60,
            max_entries=settings.cache_max_entries,
            clock=clock,
        ),
        breaker=CircuitBreaker(settings.breaker_failure_threshold, settings.breaker_open_seconds),
        settings=settings,
        history=make_history(settings.db_url),
    )
    limiter = RateLimiter(settings.rate_limit_per_minute, 60)

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        jobs: list[asyncio.Task] = []
        history = service.history
        if settings.db_url:
            await history.create_schema()  # type: ignore[attr-defined]
            await history.sync_countries(catalog.countries, catalog.editions)
        if start_jobs:
            prewarm = [c for c in settings.prewarm_country_list if c in catalog.by_code]
            jobs.append(
                asyncio.create_task(
                    prewarm_loop(service, prewarm, settings.prewarm_interval_minutes * 60, settings.prewarm_pause_seconds)
                )
            )
            if settings.db_url:
                jobs.append(asyncio.create_task(nightly_cleanup_loop(service)))
        app.state.ready = True
        log.info("service started", extra={"countries": len(catalog.countries), "editions": len(catalog.editions)})
        try:
            yield
        finally:
            # Uvicorn has already finished in-flight requests by the time we get here.
            app.state.ready = False
            for job in jobs:
                job.cancel()
            await asyncio.gather(*jobs, return_exceptions=True)
            await service.aclose()
            if owns_provider:
                await provider.aclose()  # type: ignore[attr-defined]
            log.info("service stopped")

    app = FastAPI(title="News Dashboard API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", redoc_url=None,
                  openapi_url="/api/openapi.json")
    app.state.ready = False
    app.state.service = service
    app.state.catalog = catalog

    if settings.allowed_origin:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.allowed_origin],
            allow_methods=["GET"],
            allow_headers=["Accept"],
        )

    # --- request log, metrics and last-resort error handling --------------------------

    @app.middleware("http")
    async def observe(request: Request, call_next):
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error", extra={"path": request.url.path})
            response = error_response(ApiError(500, "internal_error", "Something went wrong."))
        duration = time.perf_counter() - started
        path = request.url.path if request.url.path in _ROUTES else "other"
        REQUESTS.labels(path, str(response.status_code)).inc()
        REQUEST_DURATION.labels(path).observe(duration)
        if path != "/metrics":
            log.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "country": getattr(request.state, "country", None),
                    "section": getattr(request.state, "section", None),
                    "status": response.status_code,
                    "duration_ms": round(duration * 1000, 1),
                    "cache": getattr(request.state, "cache", None),
                },
            )
        return response

    @app.exception_handler(ApiError)
    async def handle_api_error(_request: Request, err: ApiError):
        return error_response(err)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_request: Request, err: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(err.status_code, "http_error")
        message = {404: "Not found.", 405: "Method not allowed."}.get(err.status_code, str(err.detail))
        return error_response(ApiError(err.status_code, code, message))

    @app.exception_handler(Exception)
    async def handle_unexpected(_request: Request, err: Exception):
        log.error("unhandled error", exc_info=err)
        return error_response(ApiError(500, "internal_error", "Something went wrong."))

    # --- routes -----------------------------------------------------------------------

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/ready")
    async def ready(request: Request):
        if request.app.state.ready and catalog.countries:
            return {"status": "ready"}
        return JSONResponse({"status": "starting"}, status_code=503)

    @app.get("/api/countries")
    async def countries():
        return Response(
            countries_body, media_type="application/json", headers={"Cache-Control": COUNTRIES_CACHE_CONTROL}
        )

    @app.get("/api/news")
    async def news(request: Request, country: str | None = None, section: str | None = None):
        client = request.client.host if request.client else "unknown"
        retry_after = limiter.check(client)
        if retry_after is not None:
            raise ApiError(429, "rate_limited", "Too many requests. Try again shortly.",
                           headers={"Retry-After": str(retry_after)})

        code = (country or "").strip().upper()
        if not code or catalog.country(code) is None:
            raise ApiError(400, "invalid_country", "country must be a known ISO 3166-1 alpha-2 code.")
        sec = (section or "").strip()
        if sec not in SECTIONS:
            raise ApiError(400, "invalid_section", "section must be one of nature, society, technology.")
        request.state.country, request.state.section = code, sec

        try:
            body, result = await service.get_news(code, sec)
        except UpstreamUnavailable:
            request.state.cache = "miss"
            raise ApiError(502, "upstream_unavailable", "News is temporarily unavailable. Please try again later.")
        request.state.cache = result
        return Response(
            body.model_dump_json(exclude_none=True),
            media_type="application/json",
            headers={"Cache-Control": NEWS_CACHE_CONTROL},
        )

    @app.get("/api/geo")
    async def geo(request: Request):
        """The visitor's country as seen by the CDN or host in front of us, or null.

        Only used to choose a default country, so a spoofed header just changes the
        caller's own default. Locally no such header exists and the frontend falls back
        to the device time zone.
        """
        code = None
        for header in settings.geo_header_list:
            value = (request.headers.get(header) or "").strip().upper()
            if value and catalog.country(value) is not None:  # ignores "XX", "T1" (Tor) etc.
                code = value
                break
        return JSONResponse({"country": code}, headers={"Cache-Control": "private, no-store"})

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    if settings.static_dir:
        _serve_frontend(app, Path(settings.static_dir))

    return app


def _serve_frontend(app: FastAPI, static_dir: Path) -> None:
    """Serve the built web app. Registered last, so every API route wins.

    Files that exist are returned as is (hashed /assets/* cached for a year); any other
    page path such as /explore gets index.html so the app's router can handle it.
    """
    root = static_dir.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise ConfigError(f"STATIC_DIR has no index.html: {root}")

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str):
        if path in ("api", "metrics") or path.startswith("api/"):
            raise StarletteHTTPException(404)
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "public, max-age=3600"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        if "." in path.rsplit("/", 1)[-1]:
            raise StarletteHTTPException(404)  # a missing file, not a page
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
