"""Production entry point: `uvicorn app.server:app --port 8080`."""

from .config import get_settings
from .logging_setup import setup_logging
from .main import create_app

setup_logging(get_settings().log_level)
app = create_app()
