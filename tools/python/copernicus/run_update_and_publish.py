from __future__ import annotations

import importlib.util
import os
import re
import subprocess
import sys
import traceback
from contextlib import redirect_stderr, redirect_stdout
from collections.abc import Callable
from io import TextIOBase
from pathlib import Path
from types import ModuleType

from dotenv import load_dotenv

from _log import format_line, strip_ansi

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parents[2]
UPDATE_SCRIPT = SCRIPT_DIR / "01_update_processed.py"
PLOT_SCRIPT = SCRIPT_DIR / "02_create_linear_plot.py"
OUTPUT_IMAGE = SCRIPT_DIR / "_results" / "uk_sst_daily_linear_historical_vs_current.png"
OUTPUT_JSON = SCRIPT_DIR / "_results" / "current-sea-temperature.json"
RESULTS_DIR = SCRIPT_DIR / "_results"
APP_LOG_FILE = Path(os.path.expanduser(os.getenv("APP_LOG_FILE", "~/logs/app.log")))
_LOG_LINE_RE = re.compile(r"^(?P<timestamp>.+?) \[(?P<level>INFO|WARN|FAIL|PASS)\] (?P<message>.*)$")
_LEVEL_COLOURS = {
    "INFO": "\033[37m",
    "WARN": "\033[38;5;208m",
    "FAIL": "\033[31m",
    "PASS": "\033[32m",
}
_RESET = "\033[0m"
_THIRD_PARTY_WARNING_PREFIXES = (
    "WARNING -",
    "WARNING:",
    "UserWarning:",
    "FutureWarning:",
    "DeprecationWarning:",
    "RuntimeWarning:",
)
_LOG_BUFFER: list[str] = []


def _should_suppress_line(text: str) -> bool:
    return any(text.startswith(prefix) for prefix in _THIRD_PARTY_WARNING_PREFIXES)


def _write_log_line(level: str, message: str) -> None:
    line = format_line(level, message)
    colour = _LEVEL_COLOURS.get(level, "")
    coloured_line = f"{colour}{line}{_RESET}" if colour else line
    sys.__stdout__.write(f"{colour}{line}{_RESET}\n" if colour else f"{line}\n")
    sys.__stdout__.flush()
    _LOG_BUFFER.append(coloured_line)


def _write_log_file(lines: list[str]) -> None:
    APP_LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    APP_LOG_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _write_success_log(my_new_count: int, nrt_new_count: int) -> None:
    _write_log_file([
        format_line(
            "PASS",
            f"Daily SST update complete with {my_new_count} new MY and {nrt_new_count} new NRT data points.",
        )
    ])


def _write_failure_log(trace: str) -> None:
    lines = list(_LOG_BUFFER)
    trace = trace.rstrip()
    if trace:
        lines.extend(trace.splitlines())
    if not lines:
        lines = [format_line("FAIL", "Unknown failure")]
    _write_log_file(lines)


def _write_captured_line(text: str) -> None:
    clean_text = strip_ansi(text).rstrip()
    if _should_suppress_line(clean_text):
        return
    match = _LOG_LINE_RE.match(clean_text)
    if match:
        _write_log_line(match.group("level"), match.group("message"))
        return
    _write_log_line("INFO", clean_text)


def _log_block(text: str) -> None:
    for line in text.splitlines():
        if line.strip():
            _write_captured_line(line)


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
                _write_captured_line(line)
        return len(text)

    def flush(self) -> None:
        if self._buffer.strip():
            _write_captured_line(self._buffer.rstrip())
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
            _write_captured_line(line.rstrip())
    exit_code = process.wait()
    if exit_code != 0:
        raise subprocess.CalledProcessError(exit_code, command)


def _load_update_main() -> tuple[ModuleType, Callable[[], bool]]:
    spec = importlib.util.spec_from_file_location("copernicus_update_processed", UPDATE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load updater: {UPDATE_SCRIPT}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    update_main = getattr(module, "main", None)
    if not callable(update_main):
        raise RuntimeError(f"Updater does not define a callable main(): {UPDATE_SCRIPT}")
    return module, update_main


def main() -> None:
    _LOG_BUFFER.clear()
    load_dotenv(APP_ROOT / ".env")
    _write_log_line("INFO", f"Starting Copernicus update wrapper using {APP_LOG_FILE}")

    module, update_main = _load_update_main()
    try:
        tee_logger = _TeeLogger()
        with redirect_stdout(tee_logger), redirect_stderr(tee_logger):
            has_new_data = update_main()
            tee_logger.flush()
        if not isinstance(has_new_data, bool):
            raise RuntimeError("Updater main() must return whether new data was identified.")

        my_new_count = int(getattr(module, "LAST_MY_NEW_COUNT", 0))
        nrt_new_count = int(getattr(module, "LAST_NRT_NEW_COUNT", 0))

        image_missing = not OUTPUT_IMAGE.exists()
        if not has_new_data and not image_missing:
            _write_log_line("PASS", "No new data identified; output generation skipped.")
        else:
            if image_missing and not has_new_data:
                _write_log_line("WARN", "Output image is missing; regenerating outputs anyway.")

            _write_log_line("INFO", f"Running plot generation: {PLOT_SCRIPT.name}")
            _run_logged_subprocess([sys.executable, str(PLOT_SCRIPT)])

            if not OUTPUT_IMAGE.is_file():
                raise FileNotFoundError(f"Plot script did not create expected image: {OUTPUT_IMAGE}")
            if not OUTPUT_JSON.is_file():
                raise FileNotFoundError(f"Plot script did not create expected summary: {OUTPUT_JSON}")

            _write_log_line("PASS", f"Generated API outputs: {OUTPUT_IMAGE}, {OUTPUT_JSON}")

        _write_log_line(
            "PASS",
            f"Daily SST update complete with {my_new_count} new MY and {nrt_new_count} new NRT data points.",
        )
        _write_success_log(my_new_count, nrt_new_count)
    except Exception as exc:
        _write_log_line("FAIL", str(exc))
        _write_failure_log(traceback.format_exc())
        raise


if __name__ == "__main__":
    main()