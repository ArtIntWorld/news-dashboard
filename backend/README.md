# News Dashboard backend

A small stateless FastAPI service that serves headlines for any country and three sections
(nature, society, technology) from Google News RSS, with an in-memory cache, stale-while-
revalidate, single-flight fetches, a pre-warm scheduler, a circuit breaker and a per-IP rate
limit. Built from `documents/News Dashboard Backend Design Document.pdf`.

## Run

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements-dev.txt
uvicorn app.server:app --port 8080
```

Port 8080 matches the frontend's Vite proxy. To use it from the frontend, set
`VITE_USE_MOCKS=false` in `frontend/.env` and run `npm run dev` there.

Behind a reverse proxy, start uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy ip>`
so the rate limit sees real client addresses.

## API

| Endpoint | Response |
| --- | --- |
| `GET /api/countries` | `200` `[{code, name}]` sorted by name, `Cache-Control: public, max-age=86400` |
| `GET /api/news?country=IN&section=technology` | `200` `NewsResponse`, `Cache-Control: public, max-age=300` |
| `GET /api/health` | `200 {"status":"ok"}` (liveness) |
| `GET /api/ready` | `200` once the country list is loaded, else `503` (readiness; never depends on the feed) |
| `GET /metrics` | Prometheus metrics |
| `GET /api/docs` | OpenAPI UI |

Errors always look like `{"error": {"code": "...", "message": "..."}}`:
`400 invalid_country`, `400 invalid_section`, `429 rate_limited` (with `Retry-After`),
`502 upstream_unavailable`, `500 internal_error`.

## Layout

| File | Component |
| --- | --- |
| `app/main.py` | REST API: validation, error shape, headers, request logging, CORS, lifespan |
| `app/service.py` | NewsService: cache check, stale refresh, single flight, breaker |
| `app/provider.py` | NewsProvider: feed URL mapping, fetch with timeouts/retry, RSS parsing |
| `app/normalizer.py` | Normalizer: clean, filter, dedupe, sort, cap at 30 |
| `app/cache.py` | In-memory cache with fresh/stale windows and LRU limit |
| `app/scheduler.py` | Pre-warm loop (startup + every 30 min) and nightly DB cleanup |
| `app/breaker.py`, `app/ratelimit.py` | Circuit breaker and per-IP limit |
| `app/history.py` | Optional MySQL history (only with `DB_URL`) |
| `app/data/*.json` | Country list, Google News editions, section keywords — edit these to tune, no code change |

## Configuration

All settings have defaults and can be overridden by environment variables or a `.env` file;
see `.env.example`. Section keywords live in `app/data/sections.json`, and the country to
edition-language map in `app/data/editions.json` (English is used where Google offers an
English edition). Countries without an edition fall back to an English search feed that names
the country, so their results are thinner.

## Tests

```sh
pytest              # unit, cache, concurrency, resilience and API tests; never call the live feed
pytest -m live      # optional: one real request per section, to catch feed format changes
```

## Optional MySQL history

Set `DB_URL=mysql+pymysql://user:pass@host:3306/newsdb`. On startup the service creates the
tables in `schema.sql` (if missing) and upserts the country list; after each refresh it writes
articles and a `fetch_log` row in the background. A nightly job (03:00 UTC) deletes articles
older than 30 days and fetch logs older than 14 days. Requests are always answered from the
cache, so a database failure is logged and never fails a request.
