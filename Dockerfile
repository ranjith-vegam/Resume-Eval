# ---- Frontend build ----
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend runtime ----
FROM python:3.13-slim AS runtime
WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY main.py config.py models.py session_store.py settings_store.py ./
COPY routers/ ./routers/
COPY services/ ./services/
COPY --from=frontend-build /app/static ./static

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
