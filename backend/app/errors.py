"""API errors. Every error body has one shape: {"error": {"code": "...", "message": "..."}}."""


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}

    def body(self) -> dict:
        return {"error": {"code": self.code, "message": self.message}}


class UpstreamUnavailable(Exception):
    """The feed failed and there is no cached copy to fall back on."""


class FeedError(Exception):
    """A single feed fetch failed (timeout, network, bad status, invalid XML, breaker open)."""


class BreakerOpen(FeedError):
    """Feed calls are paused by the circuit breaker."""
