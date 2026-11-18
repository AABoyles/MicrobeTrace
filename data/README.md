# Data

Reference geodata that MicrobeTrace loads at runtime through `MT.getMapData` (`src/common.js`).
Every file is fetched from `data/` by name, and the service worker caches it (`sw.js`).

None of the files records its source or licence in the file itself, and the repository's
history doesn't record either one. Each entry says what was found. Where a source isn't
recorded it says so, and nothing has been inferred.

The repository's `LICENSE` (Apache-2.0, see `NOTICE`) covers the project's own code and the
contributions made to it. It doesn't say anything about the geodata in this directory.

## Files

| File | Contents | Source | Licence | Used by | History |
|---|---|---|---|---|---|
| `counties.json` | GeoJSON, 3,221 US county polygons. Properties: `name`, `state`, `fips`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.html`, `components/choropleth.html` (County FIPS choropleth and map outlines). | Added in `d80920f` (2018-03-05). Minified in `3dcb8ed` (2018-09-27). FIPS check added in `747d7b2` (2019-02-22). |
| `countries.json` | GeoJSON, 180 country polygons. Properties: `name`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.html`, `components/choropleth.html`, `components/globe.html`. | Added in `d80920f`. Minified in `3dcb8ed`. |
| `states.json` | GeoJSON, 52 US state (and territory) polygons. Properties: `name`, `usps`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.html`, `components/choropleth.html`. | Added in `d80920f`. Minified in `3dcb8ed`. |
| `stars.json` | GeoJSON, 300 point features. Properties: `name`, `desig` (Bayer designation), `con` (constellation), `mag` (magnitude), `bv` (B-V colour index). | Source not recorded. The catalogue isn't named anywhere in the repository. | Not recorded. | `components/globe.html` (star background). | Added in `a69a5e7` (2019-04-23), the first commit of the globe view. |
| `tracts.csv` | Census tract ID (`tract`) with one latitude and longitude per tract (`_lat`, `_lon`). 74,001 rows. | Source not recorded. Converted from a larger GeoJSON in `f618dbb` (2019-01-14, "Converted big GeoJSON to smaller CSV", resolves #91). That GeoJSON isn't in the repository. | Not recorded. | `src/common.js` `MT.locateNodes`, which places nodes from their tract field. | Replaced `data/tracts.json` (added in `8b5adc8`, 2018-04-02) in `f618dbb`. |
| `zipcodes.csv` | ZIP code (`zipcode`) with one latitude and longitude per code (`_lat`, `_lon`). 42,535 rows. | Source not recorded. Converted from a larger GeoJSON in `f618dbb` (same commit as `tracts.csv`). That GeoJSON isn't in the repository. | Not recorded. | `src/common.js` `MT.locateNodes`, which places nodes from their ZIP code field. | Replaced `data/zipcodes.json` in `f618dbb`. |

## Notes

- `tracts.csv` and `zipcodes.csv` hold centroids, not boundaries.
- The two `.json` files replaced by the CSVs (`tracts.json`, `zipcodes.json`) are still in the
  git history, before `f618dbb`. They have the same content in a different format.
- Anyone who knows where these files came from, or the licence that applies to them, should record
  it here and in the commit that adds the file.
