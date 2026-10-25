"""Vercel serverless entry point.

On Vercel the built React app is served as static files and every /api/* request is
routed here (see vercel.json). The FastAPI app itself lives in backend/; this module
only makes it importable and exposes it as `app`, the ASGI name Vercel looks for.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402

__all__ = ["app"]
