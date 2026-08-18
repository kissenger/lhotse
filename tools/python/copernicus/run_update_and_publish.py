from __future__ import annotations

import importlib.util
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parents[2]
UPDATE_SCRIPT = SCRIPT_DIR / "01_update_processed.py"
PLOT_SCRIPT = SCRIPT_DIR / "02_create_linear_plot.py"
OUTPUT_IMAGE = SCRIPT_DIR / "_results" / "uk_sst_daily_linear_historical_vs_current.png"
OUTPUT_JSON = SCRIPT_DIR / "_results" / "current-sea-temperature.json"


def _load_update_main() -> Callable[[], bool]:
    spec = importlib.util.spec_from_file_location("copernicus_update_processed", UPDATE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load updater: {UPDATE_SCRIPT}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    update_main = getattr(module, "main", None)
    if not callable(update_main):
        raise RuntimeError(f"Updater does not define a callable main(): {UPDATE_SCRIPT}")
    return update_main


def main() -> None:
    load_dotenv(APP_ROOT / ".env")

    update_main = _load_update_main()
    has_new_data = update_main()
    if not isinstance(has_new_data, bool):
        raise RuntimeError("Updater main() must return whether new data was identified.")

    if not has_new_data:
        print("No new data identified; output generation skipped.")
        return

    subprocess.run([sys.executable, str(PLOT_SCRIPT)], check=True, cwd=SCRIPT_DIR)

    if not OUTPUT_IMAGE.is_file():
        raise FileNotFoundError(f"Plot script did not create expected image: {OUTPUT_IMAGE}")
    if not OUTPUT_JSON.is_file():
        raise FileNotFoundError(f"Plot script did not create expected summary: {OUTPUT_JSON}")

    print(f"Generated API outputs: {OUTPUT_IMAGE}, {OUTPUT_JSON}")


if __name__ == "__main__":
    main()