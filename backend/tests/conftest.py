from datetime import date, timedelta

import pandas as pd

from app.data import Snapshot


def make_snapshot(
    actuals: list[tuple[str, float]],
    forecasts: list[tuple[str, str, float]],
    first_day: date = date(2026, 1, 2),
    last_day: date = date(2026, 1, 2),
) -> Snapshot:
    """Small in-memory snapshot.

    actuals:   (start_time, generation_mw)
    forecasts: (start_time, publish_time, generation_mw)
    """
    a = pd.DataFrame(actuals, columns=["start_time", "generation_mw"])
    a["start_time"] = pd.to_datetime(a["start_time"], utc=True)
    f = pd.DataFrame(forecasts, columns=["start_time", "publish_time", "generation_mw"])
    f["start_time"] = pd.to_datetime(f["start_time"], utc=True)
    f["publish_time"] = pd.to_datetime(f["publish_time"], utc=True)
    f["horizon_h"] = (f["start_time"] - f["publish_time"]).dt.total_seconds() / 3600
    meta = {
        "generated_at": "2026-10-01T00:00:00Z",
        "source": "test",
        "target_window": {
            "start": f"{first_day}T00:00:00Z",
            "end_exclusive": f"{last_day + timedelta(days=1)}T00:00:00Z",
        },
        "actuals": {"rows": len(a)},
        "forecasts": {"rows": len(f), "publish_runs": int(f["publish_time"].nunique())},
    }
    return Snapshot(actuals=a, forecasts=f, meta=meta)
