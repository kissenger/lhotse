import xarray as xr
import pandas as pd

da = xr.open_dataarray("_processed/uk_sst_daily_continuous_series__degc.nc")
df = da.to_dataframe(name="sst_c").reset_index()

# Filter for current year late July / early August
df['time'] = pd.to_datetime(df['time'])
aug_data = df[(df['time'] >= '2026-07-20') & (df['time'] <= '2026-08-05')]

print(aug_data[['time', 'sst_c']].to_string(index=False))