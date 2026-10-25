"""FastAPI application: the JSON API under /api and, when built, the React app at /."""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import router

app = FastAPI(
    title="Wind Forecast Monitor API",
    version="0.1.0",
    description="UK national wind generation: day-ahead forecasts against actual outturn "
    "(Elexon FUELHH and WINDFOR).",
    # Keep everything the backend serves under /api so one routing rule covers it.
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
app.include_router(router)

# In the single-container build FastAPI also serves the compiled frontend.
# Mounted last so it never shadows /api routes.
_frontend_dist = os.environ.get("FRONTEND_DIST")
if _frontend_dist and Path(_frontend_dist).is_dir():
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
