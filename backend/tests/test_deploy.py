"""The Vercel entry point and its requirements stay in step with the backend."""

import importlib.util
import json
from pathlib import Path

from app.main import app

ROOT = Path(__file__).resolve().parents[2]


def pins(path: Path) -> dict[str, str]:
    """name -> version for every `name==version` line, ignoring extras and comments."""
    out = {}
    for line in path.read_text().splitlines():
        line = line.split("#")[0].strip()
        if "==" in line:
            name, version = line.split("==")
            out[name.split("[")[0].strip().lower()] = version.strip()
    return out


def test_vercel_requirements_match_backend_pins():
    vercel = pins(ROOT / "requirements.txt")
    backend = pins(ROOT / "backend" / "requirements.txt")
    assert vercel, "requirements.txt at the repo root lists no pinned packages"
    assert {name: backend.get(name) for name in vercel} == vercel


def test_vercel_entry_point_exposes_the_fastapi_app():
    spec = importlib.util.spec_from_file_location("vercel_entry", ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.app is app


def test_vercel_config_routes_api_and_bundles_backend():
    config = json.loads((ROOT / "vercel.json").read_text())
    assert config["outputDirectory"] == "frontend/dist"
    assert {"source": "/api/(.*)", "destination": "/api/index"} in config["rewrites"]
    assert "backend/{app,data}/**" in config["functions"]["api/index.py"]["includeFiles"]
