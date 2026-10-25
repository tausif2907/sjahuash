"""FastAPI application: the JSON API under /api and, when built, the React app at /."""

import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import config

app = FastAPI(title="Wind Forecast Monitor API", version="0.1.0")


@app.get("/api/health")
def health() -> dict:
    meta_path = config.DATA_DIR / config.META_FILE
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else None
    return {
        "status": "ok",
        "snapshot_generated_at": meta["generated_at"] if meta else None,
    }


# In the single-container build FastAPI also serves the compiled frontend.
# Mounted last so it never shadows /api routes.
_frontend_dist = os.environ.get("FRONTEND_DIST")
if _frontend_dist and Path(_frontend_dist).is_dir():
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
