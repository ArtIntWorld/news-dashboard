"""Prometheus metrics, exposed at /metrics."""

from prometheus_client import Counter, Gauge, Histogram

REQUESTS = Counter("news_http_requests_total", "API requests by path and status", ["path", "status"])
REQUEST_DURATION = Histogram("news_http_request_duration_seconds", "API request duration", ["path"])
CACHE_RESULTS = Counter("news_cache_results_total", "Cache lookups by result", ["result"])
FEED_DURATION = Histogram(
    "news_feed_call_duration_seconds",
    "Duration of each feed HTTP call",
    buckets=(0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 13),
)
FEED_FAILURES = Counter("news_feed_failures_total", "Failed feed fetches by country", ["country"])
BREAKER_OPEN = Gauge("news_feed_breaker_open", "1 while the circuit breaker pauses feed calls")
PREWARM_DURATION = Histogram("news_prewarm_run_duration_seconds", "Duration of a pre-warm run")
PREWARM_FAILURES = Counter("news_prewarm_failures_total", "Views that failed to refresh during pre-warm")
