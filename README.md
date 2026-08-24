# Treasury Auction Demand Tracker

Tracks demand at U.S. Treasury auctions across the yield curve, to answer which tenors the market is absorbing well and which it isn't.

## Development

The data pipeline lives in `pipeline/`, kept separate from any future frontend code, and is tested with pytest.

Set up a local environment:

```bash
python -m venv .venv
.venv/Scripts/activate   # on macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

Run the test suite:

```bash
pytest
```

This excludes the network canary test, which hits the live Fiscal Data API and is
run deliberately rather than as part of the normal suite:

```bash
pytest -m network
```

Run type checking:

```bash
mypy
```
