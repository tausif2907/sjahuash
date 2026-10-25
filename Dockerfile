# syntax=docker/dockerfile:1

# --- Stage 1: build the React app -------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: FastAPI serving the API and the built app ---------------------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    FRONTEND_DIST=/srv/frontend

WORKDIR /srv/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt
COPY backend/app ./app
COPY backend/data ./data
COPY --from=frontend /build/dist /srv/frontend

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# sh -c so $PORT (set by Heroku and similar hosts) is expanded; exec so uvicorn gets signals.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
