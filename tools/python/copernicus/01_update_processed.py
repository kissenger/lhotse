from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import copernicusmarine
import numpy as np
import pandas as pd
import xarray as xr
from dotenv import load_dotenv
from matplotlib.path import Path as MplPath
from scipy.ndimage import distance_transform_edt

SERVER_DIR = Path(__file__).resolve().parent
RAW_DIR = SERVER_DIR / "_raw"
PROCESSED_DIR = SERVER_DIR / "_processed"
ASSETS_DIR = SERVER_DIR / "_assets"
RESULTS_DIR = SERVER_DIR / "_results"

DAILY_SERIES_FILE = PROCESSED_DIR / "uk_sst_daily_continuous_series__degc.nc"
DIAGNOSTICS_FILE = PROCESSED_DIR / "uk_sst_source_stitch_diagnostics.txt"
MASK_CACHE_FILE = ASSETS_DIR / "coastal_masks.npz"
LEGACY_MASK_CACHE_FILE = PROCESSED_DIR / "coastal_masks.npz"
LOCAL_SEED_DIR = SERVER_DIR.parent / "_processed"

MY_DATASET_ID = "cmems-IFREMER-ATL-SST-L4-REP-OBS_FULL_TIME_SERIE"
NRT_DATASET_ID = "IFREMER-ATL-SST-L4-NRT-OBS_FULL_TIME_SERIE"
DOWNLOAD_VARIABLE = "analysed_sst"
VARIABLE_CANDIDATES = ("analysed_sst", "sea_surface_temperature")

MINIMUM_LONGITUDE = -12.0
MAXIMUM_LONGITUDE = 4.0
MINIMUM_LATITUDE = 48.0
MAXIMUM_LATITUDE = 62.5
MY_COASTAL_DISTANCE_CELLS = 1
NRT_COASTAL_DISTANCE_CELLS = 2
EXCLUDED_BOUNDARY_REGIONS = {"France", "Belgium"}
REQUIRED_DIAGNOSTIC_KEYS = (
    "last_my_day_used",
    "last_nrt_day_used",
    "nrt_to_my_correction_slope",
    "nrt_to_my_correction_intercept_degC",
)


def _prepare_directories() -> None:
    for directory in (RAW_DIR, PROCESSED_DIR, ASSETS_DIR, RESULTS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def _mask_cache_candidates() -> tuple[Path, ...]:
    if MASK_CACHE_FILE.exists():
        return (MASK_CACHE_FILE, LEGACY_MASK_CACHE_FILE)
    return (LEGACY_MASK_CACHE_FILE, MASK_CACHE_FILE)


def _bootstrap_processed_outputs() -> None:
    if DAILY_SERIES_FILE.exists() and DIAGNOSTICS_FILE.exists():
        _compress_daily_if_needed()
        diagnostics = _minimal_diagnostics(_load_diagnostics())
        _save_diagnostics_atomic(diagnostics)
        return

    seed_daily = LOCAL_SEED_DIR / DAILY_SERIES_FILE.name
    seed_diagnostics = LOCAL_SEED_DIR / DIAGNOSTICS_FILE.name
    if seed_daily.exists() and seed_diagnostics.exists():
        with xr.open_dataarray(seed_daily) as seed_file:
            _save_daily_atomic(seed_file.load())
        diagnostics = json.loads(seed_diagnostics.read_text(encoding="utf-8"))
        _save_diagnostics_atomic(_minimal_diagnostics(diagnostics))
        print(f"Seeded server processed data from {LOCAL_SEED_DIR}")
        return

    raise FileNotFoundError(
        "Server processing requires an initial compact daily series and diagnostics file. "
        f"Place {DAILY_SERIES_FILE.name} and {DIAGNOSTICS_FILE.name} in {PROCESSED_DIR}."
    )


def _env_float(name: str, fallback: float) -> float:
    value = os.getenv(name)
    return float(value) if value is not None else fallback


def _bounds() -> dict[str, float]:
    return {
        "minimum_longitude": _env_float("SST_MIN_LON", MINIMUM_LONGITUDE),
        "maximum_longitude": _env_float("SST_MAX_LON", MAXIMUM_LONGITUDE),
        "minimum_latitude": _env_float("SST_MIN_LAT", MINIMUM_LATITUDE),
        "maximum_latitude": _env_float("SST_MAX_LAT", MAXIMUM_LATITUDE),
    }


def _login() -> None:
    if not copernicusmarine.login(check_credentials_valid=True):
        copernicusmarine.login(
            username=os.getenv("USRNAME"),
            password=os.getenv("PASSWD"),
        )


def _find_dim_name(data_array: xr.DataArray, key: str) -> str:
    for dim in data_array.dims:
        if key in dim.lower():
            return dim
    raise ValueError(f"Could not find '{key}' dimension in {data_array.dims}")


def _resolve_sst_variable(dataset: xr.Dataset) -> xr.DataArray:
    for name in VARIABLE_CANDIDATES:
        if name in dataset.data_vars:
            return dataset[name]
    available = ", ".join(dataset.data_vars)
    raise KeyError(f"No supported SST variable found. Available variables: {available}")


def _to_celsius(data_array: xr.DataArray) -> xr.DataArray:
    units = str(data_array.attrs.get("units", "")).strip().lower()
    if units in {"k", "kelvin"}:
        converted = data_array - np.float32(273.15)
        converted.attrs["units"] = "degC"
        return converted
    return data_array


def _resolve_boundaries_dir() -> Path:
    override = os.getenv("SST_BOUNDARIES_DIR")
    project_root = SERVER_DIR.parents[3]
    candidates = [Path(override).expanduser()] if override else []
    candidates.append(project_root / "_mapdata" / "boundaries")
    for candidate in candidates:
        if candidate.exists() and any(candidate.rglob("*.shp")):
            return candidate.resolve()
    searched = ", ".join(str(path) for path in candidates)
    raise FileNotFoundError(f"No boundary shapefiles found. Searched: {searched}")


def _load_boundary_polygons(boundaries_dir: Path) -> list[np.ndarray]:
    import shapefile

    polygons: list[np.ndarray] = []
    for shape_path in sorted(boundaries_dir.rglob("*.shp")):
        if any(part in EXCLUDED_BOUNDARY_REGIONS for part in shape_path.parts):
            continue
        reader = shapefile.Reader(str(shape_path))
        for shape in reader.shapes():
            points = np.asarray(shape.points, dtype=np.float64)
            if points.size == 0:
                continue
            parts = list(shape.parts) + [len(points)]
            for index in range(len(parts) - 1):
                polygon = points[parts[index]:parts[index + 1]]
                if polygon.shape[0] >= 3:
                    polygons.append(polygon)
    if not polygons:
        raise ValueError(f"No boundary polygons loaded from {boundaries_dir}")
    return polygons


def _grid_signature(data_array: xr.DataArray, distance_cells: int) -> str:
    lat_dim = _find_dim_name(data_array, "lat")
    lon_dim = _find_dim_name(data_array, "lon")
    digest = hashlib.sha1()
    digest.update(np.asarray(data_array[lat_dim].values, dtype=np.float64).tobytes())
    digest.update(np.asarray(data_array[lon_dim].values, dtype=np.float64).tobytes())
    digest.update(str(int(distance_cells)).encode("ascii"))
    return digest.hexdigest()[:16]


def _load_cached_mask(signature: str) -> np.ndarray | None:
    key = f"mask_{signature}"
    for cache_file in _mask_cache_candidates():
        if not cache_file.exists():
            continue
        try:
            with np.load(cache_file, allow_pickle=False) as cache:
                if key in cache:
                    return cache[key].astype(bool)
        except (OSError, ValueError):
            continue
    return None


def _save_cached_mask(signature: str, mask: np.ndarray) -> None:
    payload: dict[str, np.ndarray] = {}
    for cache_file in _mask_cache_candidates():
        if not cache_file.exists():
            continue
        try:
            with np.load(cache_file, allow_pickle=False) as cache:
                payload.update({key: cache[key] for key in cache.files})
        except (OSError, ValueError):
            continue
    payload[f"mask_{signature}"] = mask.astype(np.uint8)
    np.savez_compressed(MASK_CACHE_FILE, **payload)


def _build_coastal_mask(
    data_array: xr.DataArray,
    polygons: list[np.ndarray],
    distance_cells: int,
) -> np.ndarray:
    lat_dim = _find_dim_name(data_array, "lat")
    lon_dim = _find_dim_name(data_array, "lon")
    lats = np.asarray(data_array[lat_dim].values, dtype=np.float64)
    lons = np.asarray(data_array[lon_dim].values, dtype=np.float64)
    mesh_lons, mesh_lats = np.meshgrid(lons, lats)
    points = np.column_stack([mesh_lons.ravel(), mesh_lats.ravel()])

    land_flat = np.zeros(points.shape[0], dtype=bool)
    for polygon in polygons:
        land_flat |= MplPath(polygon).contains_points(points)
    land_mask = land_flat.reshape(mesh_lats.shape)
    ocean_mask = ~land_mask
    return ocean_mask & (distance_transform_edt(ocean_mask) <= float(distance_cells))


def _coastal_mask(data_array: xr.DataArray, distance_cells: int) -> xr.DataArray:
    lat_dim = _find_dim_name(data_array, "lat")
    lon_dim = _find_dim_name(data_array, "lon")
    signature = _grid_signature(data_array, distance_cells)
    mask = _load_cached_mask(signature)
    if mask is None:
        polygons = _load_boundary_polygons(_resolve_boundaries_dir())
        mask = _build_coastal_mask(data_array, polygons, distance_cells)
        _save_cached_mask(signature, mask)
        print(f"Cached coastal mask {signature} ({int(mask.sum())} cells)")

    expected_shape = (data_array.sizes[lat_dim], data_array.sizes[lon_dim])
    if mask.shape != expected_shape:
        raise ValueError(f"Cached mask shape {mask.shape} does not match grid {expected_shape}")
    return xr.DataArray(
        mask,
        dims=(lat_dim, lon_dim),
        coords={lat_dim: data_array[lat_dim], lon_dim: data_array[lon_dim]},
    )


def _area_mean_daily(data_array: xr.DataArray, mask: xr.DataArray) -> xr.DataArray:
    time_dim = _find_dim_name(data_array, "time")
    lat_dim = _find_dim_name(data_array, "lat")
    mask_values = np.asarray(mask.values, dtype=bool)
    latitudes = np.asarray(data_array[lat_dim].values, dtype=np.float32)
    weights = np.cos(np.deg2rad(latitudes)).astype(np.float32)[:, None] * mask_values
    values = np.full(data_array.sizes[time_dim], np.nan, dtype=np.float32)

    for time_index in range(data_array.sizes[time_dim]):
        daily_grid = np.asarray(data_array.isel({time_dim: time_index}).values, dtype=np.float32)
        valid = np.isfinite(daily_grid) & mask_values
        if np.any(valid):
            values[time_index] = float(
                np.sum(daily_grid[valid] * weights[valid], dtype=np.float64)
                / np.sum(weights[valid], dtype=np.float64)
            )

    series = xr.DataArray(
        values,
        dims=(time_dim,),
        coords={time_dim: data_array[time_dim]},
        name="coastal_mean_degC",
    )
    daily = series.resample({time_dim: "D"}).mean(skipna=True)
    if time_dim != "time":
        daily = daily.rename({time_dim: "time"})
    return daily.load()


def _download_source(
    label: str,
    dataset_id: str,
    start_day: pd.Timestamp,
    end_day: pd.Timestamp,
    bounds: dict[str, float],
) -> Path:
    output_file = RAW_DIR / f"{label.lower()}_increment.nc"
    output_file.unlink(missing_ok=True)
    copernicusmarine.subset(
        dataset_id=dataset_id,
        variables=[DOWNLOAD_VARIABLE],
        minimum_longitude=bounds["minimum_longitude"],
        maximum_longitude=bounds["maximum_longitude"],
        minimum_latitude=bounds["minimum_latitude"],
        maximum_latitude=bounds["maximum_latitude"],
        start_datetime=start_day.strftime("%Y-%m-%dT00:00:00"),
        end_datetime=end_day.strftime("%Y-%m-%dT23:59:59"),
        output_filename=output_file.name,
        output_directory=str(RAW_DIR),
    )
    if not output_file.exists():
        raise FileNotFoundError(f"Copernicus subset did not create {output_file}")
    return output_file


def _fetch_new_daily_values(
    label: str,
    dataset_id: str,
    last_known_day: pd.Timestamp,
    distance_cells: int,
    end_day: pd.Timestamp,
    bounds: dict[str, float],
) -> xr.DataArray:
    raw_file = RAW_DIR / f"{label.lower()}_increment.nc"
    try:
        raw_file = _download_source(label, dataset_id, last_known_day, end_day, bounds)
        with xr.open_dataset(raw_file, decode_times=True) as dataset:
            data_array = _to_celsius(_resolve_sst_variable(dataset))
            mask = _coastal_mask(data_array, distance_cells)
            daily = _area_mean_daily(data_array, mask)
        return daily.where(daily["time"] > np.datetime64(last_known_day), drop=True)
    finally:
        raw_file.unlink(missing_ok=True)


def _load_diagnostics() -> dict[str, object]:
    try:
        return json.loads(DIAGNOSTICS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read diagnostics from {DIAGNOSTICS_FILE}") from exc


def _minimal_diagnostics(diagnostics: dict[str, object]) -> dict[str, object]:
    missing = [key for key in REQUIRED_DIAGNOSTIC_KEYS if diagnostics.get(key) is None]
    if missing:
        raise ValueError(f"Diagnostics are missing required fields: {', '.join(missing)}")
    return {key: diagnostics[key] for key in REQUIRED_DIAGNOSTIC_KEYS}


def _diagnostic_day(diagnostics: dict[str, object], key: str) -> pd.Timestamp:
    value = diagnostics.get(key)
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        raise ValueError(f"Diagnostics field '{key}' is missing or invalid")
    return pd.Timestamp(parsed).normalize()


def _merge_updates(
    existing: xr.DataArray,
    my_new: xr.DataArray,
    nrt_new: xr.DataArray,
    last_my_day: pd.Timestamp,
    slope: float,
    intercept: float,
) -> tuple[xr.DataArray, pd.Timestamp, pd.Timestamp | None]:
    values = existing.to_series().astype(np.float64)
    updated_last_my = last_my_day

    if my_new.sizes.get("time", 0):
        my_values = my_new.to_series().dropna()
        values = pd.concat([values.drop(my_values.index, errors="ignore"), my_values])
        updated_last_my = max(updated_last_my, pd.Timestamp(my_values.index.max()).normalize())

    last_nrt_used: pd.Timestamp | None = None
    if nrt_new.sizes.get("time", 0):
        corrected = (nrt_new.to_series().dropna() * slope) + intercept
        corrected = corrected[corrected.index > updated_last_my]
        if not corrected.empty:
            values = pd.concat([values.drop(corrected.index, errors="ignore"), corrected])
            last_nrt_used = pd.Timestamp(corrected.index.max()).normalize()

    values = values.sort_index()
    full_index = pd.date_range(values.index.min(), values.index.max(), freq="D")
    values = values.reindex(full_index).interpolate(method="time", limit_area="inside")
    updated = xr.DataArray(
        values.to_numpy(dtype=np.float32),
        dims=("time",),
        coords={"time": values.index},
        name="uk_sst_daily_mean_continuous_degC",
        attrs={"units": "degC"},
    )
    return updated, updated_last_my, last_nrt_used


def _save_daily_atomic(daily: xr.DataArray) -> None:
    temporary_file = DAILY_SERIES_FILE.with_name(f"{DAILY_SERIES_FILE.stem}.tmp.nc")
    temporary_file.unlink(missing_ok=True)
    daily.to_netcdf(
        temporary_file,
        encoding={
            daily.name: {
                "dtype": "float32",
                "zlib": True,
                "complevel": 4,
                "shuffle": True,
            }
        },
    )
    temporary_file.replace(DAILY_SERIES_FILE)


def _compress_daily_if_needed() -> None:
    with xr.open_dataarray(DAILY_SERIES_FILE) as daily_file:
        encoding = daily_file.encoding
        is_compressed = bool(encoding.get("zlib")) or encoding.get("compression") in {
            "gzip",
            "zlib",
        }
        if is_compressed:
            return
        daily = daily_file.load()
    _save_daily_atomic(daily)
    print(f"Compressed existing server NetCDF: {DAILY_SERIES_FILE}")


def _save_diagnostics_atomic(diagnostics: dict[str, object]) -> None:
    temporary_file = DIAGNOSTICS_FILE.with_suffix(".tmp")
    temporary_file.write_text(json.dumps(diagnostics, indent=2), encoding="utf-8")
    temporary_file.replace(DIAGNOSTICS_FILE)


def main() -> bool:
    load_dotenv()
    _prepare_directories()
    _bootstrap_processed_outputs()

    diagnostics = _load_diagnostics()
    last_my_day = _diagnostic_day(diagnostics, "last_my_day_used")
    last_nrt_day = _diagnostic_day(diagnostics, "last_nrt_day_used")
    end_day = pd.Timestamp.now(tz="UTC").tz_localize(None).normalize()
    bounds = _bounds()

    _login()
    my_new = _fetch_new_daily_values(
        "MY",
        MY_DATASET_ID,
        last_my_day,
        MY_COASTAL_DISTANCE_CELLS,
        end_day,
        bounds,
    )
    nrt_new = _fetch_new_daily_values(
        "NRT",
        NRT_DATASET_ID,
        last_nrt_day,
        NRT_COASTAL_DISTANCE_CELLS,
        end_day,
        bounds,
    )

    my_new_count = int(my_new.sizes.get("time", 0))
    nrt_new_count = int(nrt_new.sizes.get("time", 0))
    if my_new_count == 0 and nrt_new_count == 0:
        print("No new MY or NRT daily data is available.")
        return False

    with xr.open_dataarray(DAILY_SERIES_FILE) as existing_file:
        existing = existing_file.load()

    slope = float(diagnostics.get("nrt_to_my_correction_slope", 1.0))
    intercept = float(diagnostics.get("nrt_to_my_correction_intercept_degC", 0.0))
    updated, updated_last_my, last_nrt_used = _merge_updates(
        existing,
        my_new,
        nrt_new,
        last_my_day,
        slope,
        intercept,
    )
    _save_daily_atomic(updated)

    diagnostics["last_my_day_used"] = updated_last_my.strftime("%Y-%m-%d")
    if last_nrt_used is not None:
        diagnostics["last_nrt_day_used"] = last_nrt_used.strftime("%Y-%m-%d")
    _save_diagnostics_atomic(_minimal_diagnostics(diagnostics))

    print("Incremental daily SST update complete")
    print(f"  MY days added: {my_new_count}")
    print(f"  NRT days downloaded: {nrt_new_count}")
    print(f"  Series end: {pd.Timestamp(updated['time'].values[-1]).strftime('%Y-%m-%d')}")
    print(f"  Processed series: {DAILY_SERIES_FILE}")
    return True


if __name__ == "__main__":
    main()
