# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps: build tools for psycopg2/reportlab/qrcode (Pillow) + libpq runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential libpq-dev libjpeg-dev zlib1g-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

# collectstatic runs at build so WhiteNoise has hashed assets ready. A dummy
# SECRET_KEY keeps the build from requiring real secrets; real config is injected
# at runtime via the environment.
RUN DJANGO_COLLECTSTATIC=1 SECRET_KEY=build-only-key DEBUG=False \
    python manage.py collectstatic --noinput || true

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/media /app/staticfiles \
    && chmod +x /app/entrypoint.sh \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# entrypoint waits for the DB + migrates, then runs the CMD.
ENTRYPOINT ["/app/entrypoint.sh"]

# 3 workers is a sane default for a small VPS; override GUNICORN_CMD_ARGS to tune.
CMD ["gunicorn", "sclero_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
