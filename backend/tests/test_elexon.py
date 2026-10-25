from datetime import UTC, date, datetime

import pytest

from app.elexon import (
    FUELHH_PATH,
    WINDFOR_PATH,
    ElexonClient,
    date_chunks,
    datetime_chunks,
    to_api_datetime,
)


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeSession:
    """Records every GET and replies with the next canned payload."""

    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = []

    def get(self, url, params, timeout):
        self.calls.append((url, params))
        return FakeResponse(self.payloads.pop(0))


def test_date_chunks_cover_range_without_overlap():
    chunks = list(date_chunks(date(2026, 1, 1), date(2026, 1, 16), days=7))
    assert chunks == [
        (date(2026, 1, 1), date(2026, 1, 7)),
        (date(2026, 1, 8), date(2026, 1, 14)),
        (date(2026, 1, 15), date(2026, 1, 16)),
    ]


def test_date_chunks_single_day():
    assert list(date_chunks(date(2026, 1, 5), date(2026, 1, 5))) == [
        (date(2026, 1, 5), date(2026, 1, 5))
    ]


def test_datetime_chunks_share_boundaries_and_stop_at_end():
    start = datetime(2025, 12, 29, tzinfo=UTC)
    end = datetime(2026, 1, 10, 12, tzinfo=UTC)
    chunks = list(datetime_chunks(start, end, days=7))
    assert chunks == [
        (start, datetime(2026, 1, 5, tzinfo=UTC)),
        (datetime(2026, 1, 5, tzinfo=UTC), end),
    ]


def test_datetime_chunks_empty_when_start_equals_end():
    t = datetime(2026, 1, 1, tzinfo=UTC)
    assert list(datetime_chunks(t, t)) == []


def test_to_api_datetime_formats_as_utc_z():
    assert to_api_datetime(datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)) == "2026-01-02T03:04:05Z"


def test_fetch_actuals_chunks_requests_and_concatenates():
    session = FakeSession([[{"a": 1}], [{"a": 2}, {"a": 3}]])
    client = ElexonClient(session=session, base_url="https://example.test/api/")

    rows = client.fetch_actuals(date(2026, 1, 1), date(2026, 1, 10))

    assert rows == [{"a": 1}, {"a": 2}, {"a": 3}]
    assert [c[0] for c in session.calls] == ["https://example.test/api" + FUELHH_PATH] * 2
    assert session.calls[0][1] == {
        "settlementDateFrom": "2026-01-01",
        "settlementDateTo": "2026-01-07",
        "fuelType": "WIND",
    }
    assert session.calls[1][1]["settlementDateFrom"] == "2026-01-08"
    assert session.calls[1][1]["settlementDateTo"] == "2026-01-10"


def test_fetch_forecasts_uses_publish_time_filters():
    session = FakeSession([[{"f": 1}]])
    client = ElexonClient(session=session)

    rows = client.fetch_forecasts(
        datetime(2025, 12, 29, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
    )

    assert rows == [{"f": 1}]
    url, params = session.calls[0]
    assert url.endswith(WINDFOR_PATH)
    assert params == {
        "publishDateTimeFrom": "2025-12-29T00:00:00Z",
        "publishDateTimeTo": "2026-01-02T00:00:00Z",
    }


@pytest.mark.parametrize("payload", [{"data": [{"x": 1}]}, [{"x": 1}]])
def test_get_accepts_bare_list_or_data_envelope(payload):
    client = ElexonClient(session=FakeSession([payload]))
    assert client.fetch_forecasts(
        datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 1, 2, tzinfo=UTC)
    ) == [{"x": 1}]
