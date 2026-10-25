"""Download Elexon wind actuals and forecasts and write the snapshot the API serves.

Usage, from backend/:
    python -m app.ingest                                  # default window (January 2026)
    python -m app.ingest --start 2026-01-01 --end 2026-01-31

Writes data/actuals.csv, data/forecasts.csv and data/meta.json. The snapshot is
committed to the repo because the period is historical and will not change.

Cleaning rules:
- actuals:   fuelType WIND only, startTime inside the target window, one row per startTime.
- forecasts: rows whose startTime is before their publishTime are dropped (WINDFOR
             re-publishes up to ~25 h of past hours; those are not forecasts), then
             startTime must be inside the target window, one row per (startTime, publishTime).
Every dropped row is counted in meta.json so the cleaning is auditable.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any

import pandas as pd

from app import config
from app.elexon import FUELHH_PATH, WINDFOR_PATH, ElexonClient

log = logging.getLogger(__name__)

TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
ACTUAL_COLUMNS = [
    "start_time",
    "settlement_date",
    "settlement_period",
    "generation_mw",
    "publish_time",
]
FORECAST_COLUMNS = ["start_time", "publish_time", "horizon_h", "generation_mw"]


def _iso(ts: Any) -> str:
    return pd.Timestamp(ts).strftime(TIME_FORMAT)


def clean_actuals(
    rows: list[dict[str, Any]], start: datetime, end: datetime
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Normalise raw FUELHH rows to one WIND reading per half hour in [start, end)."""
    stats: dict[str, Any] = {"raw_rows": len(rows)}
    df = pd.DataFrame(
        rows,
        columns=[
            "startTime",
            "publishTime",
            "settlementDate",
            "settlementPeriod",
            "fuelType",
            "generation",
        ],
    )

    is_wind = df["fuelType"] == "WIND"
    stats["dropped_other_fuel"] = int((~is_wind).sum())
    df = df[is_wind].rename(
        columns={
            "startTime": "start_time",
            "publishTime": "publish_time",
            "settlementDate": "settlement_date",
            "settlementPeriod": "settlement_period",
            "generation": "generation_mw",
        }
    )
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    df["settlement_period"] = df["settlement_period"].astype(int)
    df["generation_mw"] = pd.to_numeric(df["generation_mw"])

    in_window = df["start_time"].between(start, end, inclusive="left")
    stats["dropped_outside_window"] = int((~in_window).sum())
    df = df[in_window]

    before = len(df)
    df = df.sort_values(["start_time", "publish_time"]).drop_duplicates("start_time", keep="last")
    stats["dropped_duplicates"] = before - len(df)

    expected = pd.date_range(start, end, freq="30min", inclusive="left")
    missing = expected.difference(pd.DatetimeIndex(df["start_time"]))
    stats["rows"] = len(df)
    stats["missing_periods"] = [_iso(t) for t in missing]
    return df[ACTUAL_COLUMNS].reset_index(drop=True), stats


def clean_forecasts(
    rows: list[dict[str, Any]], start: datetime, end: datetime
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Normalise raw WINDFOR rows to genuine forecasts for target times in [start, end)."""
    stats: dict[str, Any] = {"raw_rows": len(rows)}
    df = pd.DataFrame(rows, columns=["startTime", "publishTime", "generation"]).rename(
        columns={
            "startTime": "start_time",
            "publishTime": "publish_time",
            "generation": "generation_mw",
        }
    )
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    df["generation_mw"] = pd.to_numeric(df["generation_mw"])
    df["horizon_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600

    negative = df["horizon_h"] < 0
    stats["dropped_negative_horizon"] = int(negative.sum())
    df = df[~negative]

    in_window = df["start_time"].between(start, end, inclusive="left")
    stats["dropped_outside_window"] = int((~in_window).sum())
    df = df[in_window]

    before = len(df)
    df = df.sort_values(["start_time", "publish_time"]).drop_duplicates(
        ["start_time", "publish_time"], keep="last"
    )
    stats["dropped_duplicates"] = before - len(df)

    # WINDFOR is hourly, so every whole hour in the window should have forecasts.
    expected = pd.date_range(start, end, freq="h", inclusive="left")
    missing = expected.difference(pd.DatetimeIndex(df["start_time"]))
    stats["rows"] = len(df)
    stats["publish_runs"] = int(df["publish_time"].nunique())
    stats["horizon_h_max"] = float(df["horizon_h"].max()) if len(df) else None
    stats["target_hours_without_forecast"] = [_iso(t) for t in missing]
    return df[FORECAST_COLUMNS].reset_index(drop=True), stats


def write_snapshot(
    out_dir: Path, actuals: pd.DataFrame, forecasts: pd.DataFrame, meta: dict[str, Any]
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    # Fixed "\n" line endings keep the committed snapshot identical across operating systems.
    csv_opts = {"index": False, "date_format": TIME_FORMAT, "lineterminator": "\n"}
    actuals.to_csv(out_dir / config.ACTUALS_FILE, **csv_opts)
    forecasts.to_csv(out_dir / config.FORECASTS_FILE, **csv_opts)
    (out_dir / config.META_FILE).write_text(json.dumps(meta, indent=2) + "\n", newline="\n")


def run(client: ElexonClient, out_dir: Path, start: datetime, end: datetime) -> dict[str, Any]:
    """Fetch, clean and write the snapshot for target times in [start, end)."""
    # Settlement dates are UK-local, so pad a day on each side and filter on UTC startTime.
    # `end` is exclusive, so end.date() is already the day after the last target.
    first_day = (start - timedelta(days=1)).date()
    last_day = end.date()
    published_from = start - config.FORECAST_LOOKBACK

    actuals, actual_stats = clean_actuals(client.fetch_actuals(first_day, last_day), start, end)
    forecasts, forecast_stats = clean_forecasts(
        client.fetch_forecasts(published_from, end), start, end
    )

    meta = {
        "generated_at": _iso(datetime.now(UTC)),
        "source": "Elexon BMRS Insights API",
        "target_window": {"start": _iso(start), "end_exclusive": _iso(end)},
        "requests": {
            "actuals": {
                "endpoint": config.ELEXON_BASE_URL + FUELHH_PATH,
                "settlement_dates": [first_day.isoformat(), last_day.isoformat()],
                "fuel_type": "WIND",
            },
            "forecasts": {
                "endpoint": config.ELEXON_BASE_URL + WINDFOR_PATH,
                "published": [_iso(published_from), _iso(end)],
            },
        },
        "actuals": actual_stats,
        "forecasts": forecast_stats,
    }
    write_snapshot(out_dir, actuals, forecasts, meta)
    return meta


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Elexon wind actuals and forecasts into a local snapshot."
    )
    parser.add_argument(
        "--start",
        type=date.fromisoformat,
        default=config.TARGET_START.date(),
        help="first delivery day, UTC (default: %(default)s)",
    )
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        default=(config.TARGET_END - timedelta(days=1)).date(),
        help="last delivery day, inclusive (default: %(default)s)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=config.DATA_DIR,
        help="where to write the snapshot (default: backend/data)",
    )
    args = parser.parse_args(argv)
    if args.end < args.start:
        parser.error("--end must not be before --start")
    return args


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = parse_args(argv)
    start = datetime.combine(args.start, time.min, tzinfo=UTC)
    end = datetime.combine(args.end + timedelta(days=1), time.min, tzinfo=UTC)

    meta = run(ElexonClient(), args.out_dir, start, end)

    a, f = meta["actuals"], meta["forecasts"]
    log.info("actuals: %d rows, %d missing half-hours", a["rows"], len(a["missing_periods"]))
    log.info(
        "forecasts: %d rows from %d runs, max horizon %.1f h, "
        "dropped %d negative-horizon, %d hours without a forecast",
        f["rows"],
        f["publish_runs"],
        f["horizon_h_max"] or 0,
        f["dropped_negative_horizon"],
        len(f["target_hours_without_forecast"]),
    )
    log.info("snapshot written to %s", args.out_dir)


if __name__ == "__main__":
    main()
