from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr
from matplotlib import dates as mdates
from matplotlib import pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.patches import FancyBboxPatch, Wedge

from _log import pass_

SERVER_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = SERVER_DIR / "_processed"
RESULTS_DIR = SERVER_DIR / "_results"
ASSETS_DIR = SERVER_DIR / "_assets"
LOGO_PATH = ASSETS_DIR / "snround.png"

DAILY_SERIES_FILE = PROCESSED_DIR / "uk_sst_daily_continuous_series__degc.nc"
OUTPUT_PNG = RESULTS_DIR / "uk_sst_daily_linear_historical_vs_current.png"
OUTPUT_JSON = RESULTS_DIR / "current-sea-temperature.json"
LINEAR_PLOT_X_AXIS_TITLE = "Month"
LINEAR_PLOT_AXIS_TITLE = "Sea Surface Temperature (\u00b0C)"
LINEAR_PLOT_TITLE = "Britain and Ireland Average Coastal Sea Temperature (1982-present)"
REFERENCE_TEXT = (
    "E.U. Copernicus Marine Service Information\n"
    "doi.org/10.48670/moi-00152, https://doi.org/10.48670/moi-00153"
)


def _add_logo_top_right(fig: plt.Figure, ax: plt.Axes) -> None:
    if not LOGO_PATH.exists():
        return
    try:
        logo_image = plt.imread(str(LOGO_PATH))
    except Exception:
        return

    figure_width, figure_height = fig.get_size_inches()
    axes_bounds = ax.get_position()
    logo_size_inches = 1.1
    margin_inches = 0.12
    logo_width = logo_size_inches / figure_width
    logo_height = logo_size_inches / figure_height
    logo_left = axes_bounds.x1 - (margin_inches / figure_width) - logo_width
    logo_bottom = axes_bounds.y1 - (margin_inches / figure_height) - logo_height
    logo_ax = fig.add_axes([logo_left, logo_bottom, logo_width, logo_height], zorder=20)
    logo_ax.imshow(logo_image)
    logo_ax.axis("off")


def _add_deviation_dial(
    ax: plt.Axes,
    deviation: float,
    anchor_date: pd.Timestamp,
    anchor_temperature: float,
    period_label: str,
) -> None:
    dial_limit = 3.0
    anchor_display = ax.transData.transform(
        (mdates.date2num(anchor_date), anchor_temperature)
    )
    anchor_x, anchor_y = ax.transAxes.inverted().transform(anchor_display)
    dial_width = 0.24
    dial_height = 0.24
    dial_ax = ax.inset_axes(
        [
            anchor_x - dial_width / 2,
            anchor_y - dial_height / 2,
            dial_width,
            dial_height,
        ],
        zorder=8,
    )
    dial_ax.set_facecolor("none")
    deviation_ramp = LinearSegmentedColormap.from_list(
        "deviation_ramp",
        ["#2166ac", "#ffffff", "#b2182b"],
    )
    segment_edges = np.linspace(0.0, 180.0, 121)
    for angle_start, angle_end in zip(segment_edges[:-1], segment_edges[1:]):
        angle_midpoint = (angle_start + angle_end) / 2.0
        ramp_position = 1.0 - (angle_midpoint / 180.0)
        dial_ax.add_patch(
            Wedge(
                (0, 0),
                1.0,
                angle_start,
                angle_end,
                width=0.18,
                facecolor=deviation_ramp(ramp_position),
                edgecolor="none",
                antialiased=False,
            )
        )

    for tick_value in np.arange(-dial_limit, dial_limit + 1.0, 1.0):
        tick_angle = np.deg2rad(90.0 - (tick_value / dial_limit) * 90.0)
        outer_x, outer_y = np.cos(tick_angle), np.sin(tick_angle)
        inner_scale = 0.76 if tick_value in {-dial_limit, 0.0, dial_limit} else 0.81
        dial_ax.plot(
            [inner_scale * outer_x, 0.96 * outer_x],
            [inner_scale * outer_y, 0.96 * outer_y],
            color="#59636b",
            linewidth=1.1,
            zorder=3,
        )

    pointer_value = float(np.clip(deviation, -dial_limit, dial_limit))
    pointer_angle = np.deg2rad(90.0 - (pointer_value / dial_limit) * 90.0)
    pointer_color = "#c94f43" if deviation >= 0 else "#24738c"
    dial_ax.plot(
        [0, 0.73 * np.cos(pointer_angle)],
        [0, 0.73 * np.sin(pointer_angle)],
        color=pointer_color,
        linewidth=3.0,
        solid_capstyle="round",
        zorder=5,
    )
    dial_ax.scatter([0], [0], s=35, color="#263238", zorder=6)

    dial_ax.text(-1.02, -0.08, "-3", ha="center", va="top", fontsize=8, color="#59636b")
    dial_ax.text(0, 1.04, "0", ha="center", va="bottom", fontsize=8, color="#59636b")
    dial_ax.text(1.02, -0.08, "+3", ha="center", va="top", fontsize=8, color="#59636b")
    dial_ax.text(
        0,
        -0.20,
        f"{deviation:+.2f}\u00b0C",
        ha="center",
        va="top",
        fontsize=14,
        fontweight="bold",
        color=pointer_color,
    )
    dial_ax.text(
        0,
        -0.48,
        period_label,
        ha="center",
        va="top",
        fontsize=7.5,
        fontweight="bold",
        color="#59636b",
    )
    dial_ax.set_xlim(-1.2, 1.2)
    dial_ax.set_ylim(-0.62, 1.18)
    dial_ax.set_aspect("equal")
    dial_ax.axis("off")


def _add_dials_panel(ax: plt.Axes) -> None:
    anchor_date = mdates.date2num(pd.Timestamp("2001-08-15"))
    lower_anchor = ax.transAxes.inverted().transform(
        ax.transData.transform((anchor_date, 8.0))
    )
    upper_anchor = ax.transAxes.inverted().transform(
        ax.transData.transform((anchor_date, 11.0))
    )
    dial_width = 0.24
    dial_height = 0.24
    padding = 0.018
    panel_left = lower_anchor[0] - dial_width / 2 - padding
    panel_right = lower_anchor[0] + dial_width / 2 + padding
    panel_bottom = lower_anchor[1] - dial_height / 2 - padding
    panel_top = upper_anchor[1] + dial_height / 2 + padding

    panel_ax = ax.inset_axes(
        [
            panel_left,
            panel_bottom,
            panel_right - panel_left,
            panel_top - panel_bottom,
        ],
        zorder=7,
    )
    panel_ax.set_facecolor("none")
    panel_ax.add_patch(
        FancyBboxPatch(
            (0, 0),
            1,
            1,
            boxstyle="round,pad=0,rounding_size=0.035",
            transform=panel_ax.transAxes,
            facecolor="#f3f4f6",
            edgecolor="#6b7280",
            linewidth=1.2,
        )
    )
    panel_ax.axis("off")


def _draw_deviation_gauge(ax: plt.Axes, deviation: float, period_label: str) -> None:
    dial_limit = 3.0
    deviation_ramp = LinearSegmentedColormap.from_list(
        "deviation_ramp",
        ["#2166ac", "#ffffff", "#b2182b"],
    )
    segment_edges = np.linspace(0.0, 180.0, 121)
    for angle_start, angle_end in zip(segment_edges[:-1], segment_edges[1:]):
        angle_midpoint = (angle_start + angle_end) / 2.0
        ramp_position = 1.0 - (angle_midpoint / 180.0)
        ax.add_patch(
            Wedge(
                (0, 0),
                1.0,
                angle_start,
                angle_end,
                width=0.18,
                facecolor=deviation_ramp(ramp_position),
                edgecolor="none",
                antialiased=False,
            )
        )

    for tick_value in np.arange(-dial_limit, dial_limit + 1.0, 1.0):
        tick_angle = np.deg2rad(90.0 - (tick_value / dial_limit) * 90.0)
        outer_x, outer_y = np.cos(tick_angle), np.sin(tick_angle)
        inner_scale = 0.76 if tick_value in {-dial_limit, 0.0, dial_limit} else 0.81
        ax.plot(
            [inner_scale * outer_x, 0.96 * outer_x],
            [inner_scale * outer_y, 0.96 * outer_y],
            color="#59636b",
            linewidth=1.1,
            zorder=3,
        )

    pointer_value = float(np.clip(deviation, -dial_limit, dial_limit))
    pointer_angle = np.deg2rad(90.0 - (pointer_value / dial_limit) * 90.0)
    pointer_color = "#c94f43" if deviation >= 0 else "#24738c"
    ax.plot(
        [0, 0.73 * np.cos(pointer_angle)],
        [0, 0.73 * np.sin(pointer_angle)],
        color=pointer_color,
        linewidth=3.0,
        solid_capstyle="round",
        zorder=5,
    )
    ax.scatter([0], [0], s=35, color="#263238", zorder=6)

    ax.text(-1.02, -0.08, "-3", ha="center", va="top", fontsize=8, color="#59636b")
    ax.text(0, 1.04, "0", ha="center", va="bottom", fontsize=8, color="#59636b")
    ax.text(1.02, -0.08, "+3", ha="center", va="top", fontsize=8, color="#59636b")
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-0.20, 1.18)
    ax.set_aspect("equal")
    ax.axis("off")


def _add_dial_card(
    fig: plt.Figure,
    left: float,
    bottom: float,
    width: float,
    height: float,
    title: str,
    deviation: float,
    period_label: str,
    fill: str,
    accent: str,
) -> None:
    card_ax = fig.add_axes([left, bottom, width, height], zorder=12)
    card_ax.axis("off")
    card_ax.add_patch(
        FancyBboxPatch(
            (0.01, 0.01),
            0.98,
            0.98,
            boxstyle="round,pad=0,rounding_size=0.035",
            transform=card_ax.transAxes,
            facecolor="#f8f9fa",
            edgecolor="#1f2937",
            linewidth=1.2,
            joinstyle="round",
            clip_on=False,
        )
    )
    pointer_color = "#c94f43" if deviation >= 0 else "#24738c"
    dial_ax = card_ax.inset_axes([0.07, 0.26, 0.48, 0.60], zorder=13)
    dial_ax.set_facecolor("none")
    _draw_deviation_gauge(dial_ax, deviation, period_label)
    card_ax.text(
        0.73,
        0.56,
        f"{deviation:+.2f}\u00b0C",
        ha="center",
        va="center",
        fontsize=17,
        fontweight="bold",
        color=pointer_color,
    )
    card_ax.text(
        0.5,
        0.12,
        period_label,
        ha="center",
        va="center",
        fontsize=7.5,
        fontweight="bold",
        color="#59636b",
    )


def _render_daily_linear_plot(
    daily_series: xr.DataArray,
    output_png: Path,
) -> dict[str, int | float | str]:
    baseline_year_count = 30

    time_values = pd.to_datetime(daily_series["time"].values)
    radial_values = np.asarray(daily_series.values, dtype=np.float64)
    valid_mask = np.isfinite(radial_values)
    if not np.any(valid_mask):
        raise ValueError("No finite values available for daily linear plot.")

    df = pd.DataFrame({
        "time": time_values[valid_mask],
        "sst_c": radial_values[valid_mask],
    })
    df["year"] = df["time"].dt.year
    df["month_day"] = df["time"].dt.strftime("%m-%d")

    x_dates = pd.date_range("2001-01-01", "2001-12-31", freq="D")
    month_day_order = pd.Index(x_dates.strftime("%m-%d"), name="month_day")
    df = df[df["month_day"] != "02-29"]
    by_day_year = (
        df.pivot_table(index="month_day", columns="year", values="sst_c", aggfunc="mean")
        .reindex(month_day_order)
        .sort_index(axis=1)
    )

    if by_day_year.shape[1] < 2:
        raise ValueError("Need at least two years of data to render historical and current-year curves.")

    current_year = int(by_day_year.columns.max())
    historical_years = [int(year) for year in by_day_year.columns if int(year) != current_year]
    if not historical_years:
        raise ValueError("No historical years available after excluding the current year.")

    baseline_years = historical_years[:baseline_year_count]
    baseline_df = by_day_year[baseline_years]
    hist_mean = baseline_df.mean(axis=1, skipna=True)
    hist_low = baseline_df.quantile(0.025, axis=1, interpolation="linear")
    hist_high = baseline_df.quantile(0.975, axis=1, interpolation="linear")

    last_data_date = df["time"].max().normalize()
    current_curve = by_day_year[current_year].reindex(month_day_order)
    last_data_x = pd.Timestamp(f"2001-{last_data_date.strftime('%m-%d')}")
    before_endpoint = x_dates <= last_data_x

    fig, ax = plt.subplots(figsize=(10, 8.25), dpi=170)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    for year in historical_years:
        ax.plot(
            x_dates,
            by_day_year[year].to_numpy(dtype=np.float64),
            color="#d0d0d0",
            linewidth=0.8,
            alpha=0.7,
            zorder=1,
        )

    ax.fill_between(
        x_dates,
        hist_low.to_numpy(dtype=np.float64),
        hist_high.to_numpy(dtype=np.float64),
        color="#b9dcff",
        alpha=0.55,
        zorder=2,
        label=f"({baseline_years[0]}-{baseline_years[-1]}) 95% interval",
    )
    ax.plot(
        x_dates,
        hist_mean.to_numpy(dtype=np.float64),
        color="#1565c0",
        linewidth=2.4,
        zorder=3,
        label=f"({baseline_years[0]}-{baseline_years[-1]}) mean",
    )

    current_curve_values = current_curve.to_numpy(dtype=np.float64)
    ax.plot(
        x_dates[before_endpoint],
        current_curve_values[before_endpoint],
        color="#c62828",
        linewidth=2.3,
        zorder=4,
        label=f"{current_year}",
    )

    month_starts = pd.date_range("2001-01-01", periods=13, freq="MS")
    month_ticks = month_starts[:-1] + (month_starts[1:] - month_starts[:-1]) / 2
    ax.set_xticks(month_starts)
    ax.set_xticklabels([])
    ax.set_xticks(month_ticks, minor=True)
    ax.set_xticklabels(
        [date.strftime("%b") for date in month_starts[:-1]],
        minor=True,
        fontsize=10,
    )
    ax.tick_params(axis="x", which="minor", length=0)
    ax.set_xlim(month_starts[0], month_starts[-1])

    hist_low_values = pd.to_numeric(hist_low, errors="coerce").to_numpy(dtype=np.float64)
    hist_high_values = pd.to_numeric(hist_high, errors="coerce").to_numpy(dtype=np.float64)
    current_values = pd.to_numeric(current_curve, errors="coerce").to_numpy(dtype=np.float64)
    all_finite = np.concatenate([
        hist_low_values[np.isfinite(hist_low_values)],
        hist_high_values[np.isfinite(hist_high_values)],
        current_values[np.isfinite(current_values)],
    ])
    if all_finite.size == 0:
        raise ValueError("No finite values available for the linear plot y-axis range.")

    y_min = float(np.nanmin(all_finite))
    y_max = float(np.nanmax(all_finite))
    pad = max(0.3, 0.06 * (y_max - y_min))
    ax.set_ylim(y_min - pad, y_max + pad)
    y_tick_start = int(np.floor(y_min - pad))
    y_tick_end = int(np.ceil(y_max + pad))
    ax.set_yticks(np.arange(y_tick_start, y_tick_end + 1, 1))
    ax.set_box_aspect(2 / 3)
    ax.set_position([0.20, 0.10, 0.60, 0.50])

    summary = _calculate_temperature_summary(
        last_data_date,
        current_curve,
        hist_mean,
        baseline_years,
    )

    current_key = last_data_date.strftime("%m-%d")
    visible_mask = current_curve.index <= current_key
    visible_current = current_curve.loc[visible_mask] if hasattr(current_curve, "loc") else current_curve[current_curve.index <= current_key]
    visible_baseline = hist_mean.loc[visible_mask] if hasattr(hist_mean, "loc") else hist_mean[hist_mean.index <= current_key]
    annual_current_mean = float(np.nanmean(pd.to_numeric(visible_current, errors="coerce"))) if not visible_current.empty else float("nan")
    annual_baseline_mean = float(np.nanmean(pd.to_numeric(visible_baseline, errors="coerce"))) if not visible_baseline.empty else float("nan")
    annual_deviation = (
        annual_current_mean - annual_baseline_mean
        if np.isfinite(annual_current_mean) and np.isfinite(annual_baseline_mean)
        else float("nan")
    )

    ax_bounds = ax.get_position()
    card_gap = 0.02
    card_width = (ax_bounds.width - card_gap) / 2.0
    card_bottom = ax_bounds.y1 + 0.035
    card_height = 0.13

    _add_dial_card(
        fig,
        ax_bounds.x0,
        card_bottom,
        card_width,
        card_height,
        "Deviation today",
        float(summary["deviationC"]),
        "ABOVE DAILY MEAN" if summary["deviationC"] >= 0 else "BELOW DAILY MEAN",
        "#f3f4f6",
        "#b42318",
    )
    _add_dial_card(
        fig,
        ax_bounds.x1 - card_width,
        card_bottom,
        card_width,
        card_height,
        "Annual deviation",
        annual_deviation,
        "ABOVE ANNUAL MEAN" if annual_deviation >= 0 else "BELOW ANNUAL MEAN",
        "#f3f4f6",
        "#0f5ca8",
    )

    ax.set_xlabel(LINEAR_PLOT_X_AXIS_TITLE)
    ax.set_ylabel(LINEAR_PLOT_AXIS_TITLE)
    ax.grid(alpha=0.22)
    ax.legend(loc="upper left", frameon=True, framealpha=0.92)

    fig.text(
        0.5,
        0.006,
        "\n".join(
            [
                REFERENCE_TEXT,
                (
                    "Plot generated on "
                    f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}; "
                    f"last data point {last_data_date.date().isoformat()}"
                ),
            ]
        ),
        ha="center",
        va="bottom",
        fontsize=9,
        color="#555555",
    )
    _add_logo_top_right(fig, ax)
    output_png.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output_png.with_name(f"{output_png.stem}.tmp{output_png.suffix}")
    fig.savefig(
        temporary_output,
        facecolor="white",
        bbox_inches="tight",
        pad_inches=0.08,
    )
    plt.close(fig)
    temporary_output.replace(output_png)
    return summary


def _calculate_temperature_summary(
    last_data_date: pd.Timestamp,
    current_curve: pd.Series,
    historical_mean: pd.Series,
    baseline_years: list[int],
) -> dict[str, int | float | str]:
    latest_month_day = last_data_date.strftime("%m-%d")
    latest_temperature = current_curve.get(latest_month_day, np.nan)
    baseline_temperature = historical_mean.get(latest_month_day, np.nan)
    if not np.isfinite(latest_temperature) or not np.isfinite(baseline_temperature):
        raise ValueError(
            f"No finite current and baseline temperatures available for {last_data_date.date()}."
        )

    latest_temperature = float(latest_temperature)
    baseline_temperature = float(baseline_temperature)
    return {
        "schemaVersion": 1,
        "observationDate": last_data_date.date().isoformat(),
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "temperatureC": latest_temperature,
        "baselineTemperatureC": baseline_temperature,
        "deviationC": latest_temperature - baseline_temperature,
        "baselineStartYear": baseline_years[0],
        "baselineEndYear": baseline_years[-1],
    }


def _write_temperature_summary(
    summary: dict[str, int | float | str],
    output_json: Path,
) -> None:
    if not OUTPUT_JSON.exists():
        raise FileNotFoundError(
            f"Missing combined summary JSON: {OUTPUT_JSON}. Run 01_update_processed.py first."
        )

    existing_summary = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
    stitch_diagnostics = existing_summary.get("stitchDiagnostics")
    if not isinstance(stitch_diagnostics, dict):
        raise ValueError(f"Combined summary JSON does not contain stitchDiagnostics: {OUTPUT_JSON}")

    output_json.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = output_json.with_suffix(f"{output_json.suffix}.tmp")
    temporary_output.write_text(
        json.dumps(
            {
                **summary,
                "stitchDiagnostics": stitch_diagnostics,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    temporary_output.replace(output_json)


def _load_daily_series() -> xr.DataArray:
    if not DAILY_SERIES_FILE.exists():
        raise FileNotFoundError(
            f"Missing processed daily series: {DAILY_SERIES_FILE}. Run 01_update_processed.py first."
        )
    return xr.open_dataarray(DAILY_SERIES_FILE).load()


def main() -> None:
    daily_series = _load_daily_series()
    summary = _render_daily_linear_plot(
        daily_series,
        OUTPUT_PNG,
    )
    _write_temperature_summary(summary, OUTPUT_JSON)
    pass_(f"Daily linear plot: {OUTPUT_PNG}")
    pass_(f"Current temperature summary: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
