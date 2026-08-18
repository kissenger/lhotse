# Python tooling (Copernicus SST pipeline)

Runs on the Raspberry Pi (`rpi`), Python 3.9, venv at `tools/python/.venv`.

## The one thing to remember

**`pyarrow` must not be installed on the Pi.** Its ARM builds use CPU instructions
the Pi doesn't support, so importing it kills the process with `Illegal instruction`.
It arrives uninvited as a dependency of `copernicusmarine`.

Because `pandas` loads pyarrow automatically when it's present, the crash looks like
a pandas or xarray problem. It isn't. Nothing here needs pyarrow.

## Rebuilding the environment

```bash
cd ~/snorkelology/master/tools/python
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip uninstall -y pyarrow            # required
python -c "import numpy, pandas, xarray, h5py, netCDF4; print('ok')"
```

`tools/deploy.sh` already removes pyarrow after every deploy, so normal deployments
need nothing extra. `pip check` will warn that `arcosparse` wants pyarrow — ignore it.

## Restoring the data files

`_processed/*.nc` is deliberately gitignored, so a stale dev copy can never overwrite
the server's live data. A freshly rebuilt server fails with `FileNotFoundError` until
you copy the seed files across.

From the Windows dev machine (PowerShell), in the repo root:

```
scp -P 53527 -i C:\Users\gordo\.ssh/id_rsa uk_sst_daily_continuous_series__degc.nc gort1975@192.168.1.136:/home/gort1975/snorkelology/master/tools/python/copernicus/_processedlogy/master/tools/python/copernicus/_processed/
```

Then confirm on the Pi:

```bash
ls -l ~/snorkelology/master/tools/python/copernicus/_processed/
```

## If "Illegal instruction" comes back

There's no traceback, and the culprit is rarely the package you called. Find it with:

```bash
for m in numpy pandas xarray h5py netCDF4 scipy pyarrow; do
  python -c "import $m" 2>/dev/null && echo "OK   $m" || echo "FAIL $m ($?)"
done
```

Exit code 132 means it crashed; 1 means it just isn't installed.

Don't bother downgrading or pinning versions — every pandas and numpy version crashes
while pyarrow is installed, and all of them work once it's gone.

## Scheduling the Copernicus wrapper

Run the wrapper directly on a schedule; it writes timestamped lines to `~/logs/app.log` by default.

Example cron entry:

```bash
15 3 * * * cd ~/snorkelology/master && python3 tools/python/copernicus/run_update_and_publish.py
```
