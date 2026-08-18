from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from contextlib import redirect_stderr, redirect_stdout
from collections.abc import Callable
from datetime import datetime
from io import TextIOBase
from pathlib import Path

from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parents[2]
UPDATE_SCRIPT = SCRIPT_DIR / "01_update_processed.py"
PLOT_SCRIPT = SCRIPT_DIR / "02_create_linear_plot.py"
OUTPUT_IMAGE = SCRIPT_DIR / "_results" / "uk_sst_daily_linear_historical_vs_current.png"
OUTPUT_JSON = SCRIPT_DIR / "_results" / "current-sea-temperature.json"
APP_LOG_FILE = Path(os.path.expanduser(os.getenv("APP_LOG_FILE", "~/logs/app.log")))


def _timestamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _write_log_line(message: str) -> None:
    APP_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    line = f"{_timestamp()} {message}"
    with APP_LOG_FILE.open("a", encoding="utf-8") as log_file:
        log_file.write(f"{line}\n")
    print(line)


def _log_block(text: str) -> None:
    for line in text.splitlines():
        if line.strip():
            _write_log_line(line)


class _TeeLogger(TextIOBase):
    def __init__(self) -> None:
        self._buffer = ""

    def write(self, text: str) -> int:
        if not text:
            return 0

        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            if line.strip():
                _write_log_line(line)
        return len(text)

    def flush(self) -> None:
        if self._buffer.strip():
            _write_log_line(self._buffer.rstrip())
            self._buffer = ""


def _run_logged_subprocess(command: list[str]) -> None:
    process = subprocess.Popen(
        command,
        cwd=SCRIPT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        if line.strip():
            _write_log_line(line.rstrip())
    exit_code = process.wait()
    if exit_code != 0:
        raise subprocess.CalledProcessError(exit_code, command)


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
    _write_log_line(f"Starting Copernicus update wrapper using {APP_LOG_FILE}")

    update_main = _load_update_main()
    tee_logger = _TeeLogger()
    with redirect_stdout(tee_logger), redirect_stderr(tee_logger):
        has_new_data = update_main()
        tee_logger.flush()
    if not isinstance(has_new_data, bool):
        raise RuntimeError("Updater main() must return whether new data was identified.")

    if not has_new_data:
        _write_log_line("No new data identified; output generation skipped.")
        return

    _write_log_line(f"Running plot generation: {PLOT_SCRIPT.name}")
    _run_logged_subprocess([sys.executable, str(PLOT_SCRIPT)])

    if not OUTPUT_IMAGE.is_file():
        raise FileNotFoundError(f"Plot script did not create expected image: {OUTPUT_IMAGE}")
    if not OUTPUT_JSON.is_file():
        raise FileNotFoundError(f"Plot script did not create expected summary: {OUTPUT_JSON}")

    _write_log_line(f"Generated API outputs: {OUTPUT_IMAGE}, {OUTPUT_JSON}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        _write_log_line(f"ERROR {exc}")
        raise