"""Project-wide settings: the analysis window, Elexon endpoints and snapshot paths.

All times are UTC. In January the UK is on GMT, so UTC and UK local time coincide,
but the code never relies on that.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

# Delivery (target) window, end exclusive. Day-ahead purchases for delivery day D are
# made on D-1, so decisions taken in January 2026 cover delivery days 2 Jan - 1 Feb.
# 1 Jan (decided on 31 Dec) is included too, so the whole calendar month is covered.
TARGET_START = datetime(2026, 1, 1, tzinfo=UTC)
TARGET_END = datetime(2026, 2, 2, tzinfo=UTC)

# WINDFOR runs look up to ~66.5 h ahead, so a target at TARGET_START can have
# forecasts published this long before it.
FORECAST_LOOKBACK = timedelta(hours=72)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ACTUALS_FILE = "actuals.csv"
FORECASTS_FILE = "forecasts.csv"
META_FILE = "meta.json"
