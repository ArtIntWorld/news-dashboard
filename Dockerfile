# News Dashboard: one container serving the API and the web app on one origin.

# --- 1. Build the frontend -----------------------------------------------------------------
FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Production build talks to the real API on the same origin.
ENV VITE_USE_MOCKS=false \
    VITE_API_BASE_URL=
RUN npm run build

# --- 2. Run the backend --------------------------------------------------------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
COPY --from=web /web/dist ./static
ENV STATIC_DIR=/app/static

RUN useradd --create-home --uid 10001 appuser
USER appuser

# Hosts such as Render set PORT; 8080 is the local default. --proxy-headers lets the rate
# limit see real visitor addresses behind the host's load balancer.
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.server:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]
