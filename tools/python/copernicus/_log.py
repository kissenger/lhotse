from __future__ import annotations

from datetime import datetime
import re
import sys

RESET = "\033[0m"
WHITE = "\033[37m"
ORANGE = "\033[38;5;208m"
RED = "\033[31m"
GREEN = "\033[32m"
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def _timestamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def format_line(level: str, message: str) -> str:
    return f"{_timestamp()} [{level}] {message}"


def strip_ansi(text: str) -> str:
    return ANSI_RE.sub("", text)


def _emit(level: str, colour: str, message: str) -> None:
    line = format_line(level, message)
    sys.stdout.write(f"{colour}{line}{RESET}\n")
    sys.stdout.flush()


def info(message: str) -> None:
    _emit("INFO", WHITE, message)


def warn(message: str) -> None:
    _emit("WARN", ORANGE, message)


def fail(message: str) -> None:
    _emit("FAIL", RED, message)


def pass_(message: str) -> None:
    _emit("PASS", GREEN, message)