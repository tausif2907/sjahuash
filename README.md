# Wind Forecast Monitor

A web app for a UK energy supplier's day-ahead trading team. It shows the national wind
generation forecast that was available when each day-ahead purchase had to be made, and
measures how accurate those forecasts turned out to be. The data is Elexon's national wind
outturn (FUELHH) and wind forecasts (WINDFOR) for January 2026.

- **Live app:** _coming soon_
- **Stack:** React + TypeScript (Vite) · Python + FastAPI · pandas · Docker

> **Status:** data ingestion, the January 2026 snapshot and the analysis API are done.
> The dashboard views are in progress.

## Quick start

### With Docker (one container: API + built frontend)

```bash
docker compose up --build
```

Open http://localhost:8000. The API is under `/api` (e.g. http://localhost:8000/api/health).

### Local development

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload # http://localhost:8000
```

Frontend (Node 24+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api to localhost:8000
```

## Data pipeline

`backend/app/ingest.py` downloads both datasets from the
[Elexon BMRS Insights API](https://bmrs.elexon.co.uk/api-documentation) and writes a cleaned
snapshot to `backend/data/`. January 2026 is historical and won't change, so the snapshot
is committed: the app never depends on Elexon being up, and results are reproducible.

```bash
cd backend
python -m app.ingest                                     # default window
python -m app.ingest --start 2026-01-01 --end 2026-01-31 # custom delivery days
```

| Dataset | Endpoint | Filter used | Resolution |
|---|---|---|---|
| Actual wind outturn | `/datasets/FUELHH/stream` | `settlementDateFrom/To`, `fuelType=WIND` | 30 min |
| Wind forecasts | `/datasets/WINDFOR/stream` | `publishDateTimeFrom/To` | 1 hour, 8 runs a day |

**Window.** Day-ahead purchases for delivery day D are made on D-1. Decisions taken in
January 2026 therefore cover delivery days 2 Jan to 1 Feb. 1 Jan (decided on 31 Dec) is
included as well, so the snapshot covers delivery days **1 Jan to 1 Feb 2026**. Forecasts
are fetched from 72 hours before the first delivery day, since WINDFOR looks up to 66.5 h ahead.

**Cleaning rules.** Every dropped row is counted in `backend/data/meta.json`.

- Actuals: WIND only, one reading per half hour, target time inside the window.
- Forecasts: rows whose target time is *before* their publish time are dropped. WINDFOR
  re-publishes up to ~25 h of past hours, and those are not forecasts (4,201 rows).
  Then: target time inside the window, one row per (target time, publish time).
- All times are stored in UTC (in January the UK is on GMT, so UTC equals UK time).

**Current snapshot:** 1,536 half-hourly actuals (none missing) · 14,847 forecasts from
272 runs · every target hour has at least one forecast.

## How forecasts are selected and scored

For every target half-hour T the app takes the **latest forecast run published at or
before a cutoff**. Two views differ only in the cutoff:

| Mode | Cutoff | Answers |
|---|---|---|
| `decision` (default) | Day-ahead gate closure on D-1, UK time (D = T's delivery day) | What did the trader actually see when buying? |
| `horizon` | T − H hours | How does accuracy decay as the forecast looks further ahead? |

**Gate closure.** Since Brexit the GB day-ahead auctions close at **09:20** (EPEX SPOT)
and **09:50** (Nord Pool N2EX) UK time on D-1. The default is 09:20, so the chosen forecast
was available for either auction; `gate_closure=09:50` switches to N2EX. With WINDFOR's
publishing schedule this picks the 07:30 run (09:20) or the 09:30 run (09:50).

**Matching.** WINDFOR is hourly, so a forecast is compared with the FUELHH actual that has
the same `startTime`. Half-hours past the hour show the actual only.

**Metrics.** Error = actual − forecast, so **negative means less wind than forecast**, a
shortfall the buyer has to cover. Reported: MAE, RMSE, bias (mean error), nMAE (total
absolute error / total actual), P10/P50/P90 of the error, worst shortfall and surplus.
P10 is the buffer figure: in 90% of hours the shortfall was no worse than −P10. MAPE is
left out because it explodes when output is near zero.

### API

Interactive docs: `/api/docs`. All analysis endpoints accept `start` and `end` (UK delivery
days, default: the whole snapshot).

| Endpoint | Purpose |
|---|---|
| `GET /api/meta` | Data coverage, gate-closure options, row counts |
| `GET /api/series?mode=decision&gate_closure=09:20` | Half-hourly actuals with the selected forecast, its publish time, horizon and error |
| `GET /api/series?mode=horizon&horizon_h=24` | Same, for a fixed look-ahead |
| `GET /api/metrics?...` | Same selection parameters; overall, by UK hour of day, by delivery day |
| `GET /api/metrics/by-horizon?max_h=48&step_h=1` | Accuracy at each look-ahead from 0 to `max_h` hours |
| `GET /api/health` | Liveness and snapshot timestamp |

## Repository layout

```
.
├── backend/
│   ├── app/
│   │   ├── config.py      # analysis window, gate closures, Elexon URL, snapshot paths
│   │   ├── elexon.py      # HTTP client for FUELHH / WINDFOR (chunked, with retries)
│   │   ├── ingest.py      # fetch + clean + write snapshot (CLI: python -m app.ingest)
│   │   ├── data.py        # loads the snapshot once per process
│   │   ├── selection.py   # which forecast counts for each target (decision / horizon)
│   │   ├── metrics.py     # accuracy statistics: overall, by hour, by day
│   │   ├── schemas.py     # Pydantic response models (documented at /api/docs)
│   │   ├── api.py         # HTTP routes and query validation
│   │   └── main.py        # FastAPI app; serves /api and the built frontend
│   ├── data/              # committed snapshot: actuals.csv, forecasts.csv, meta.json
│   ├── tests/             # pytest suite
│   ├── pyproject.toml     # pytest and ruff config
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/              # React + TypeScript app (Vite)
│   └── src/
├── .github/workflows/ci.yml  # lint, test, build frontend, build Docker image
├── Dockerfile             # multi-stage: build frontend, then Python runtime
└── docker-compose.yml
```

## Testing and code quality

```bash
cd backend && pytest && ruff check . && ruff format --check .
cd frontend && npm run lint && npm run build
```

CI runs all of the above plus a Docker build on every push and pull request.

## Use of AI tools

This project was built with help from AI coding tools (Claude Code). They were used for
scaffolding, writing code and tests, and checking the Elexon API's behaviour. The design
decisions, analysis and final review are my own.
