# Data

Reference geodata that MicrobeTrace loads at runtime through `MT.getMapData` (`src/loading.js`).
Every file is fetched from `data/` by name, and the service worker caches it (`sw.js`).

None of the files records its source or licence in the file itself, and the repository's
history doesn't record either one. Each entry says what was found. Where a source isn't
recorded it says so, and nothing has been inferred.

The repository's `LICENSE` (Apache-2.0, see `NOTICE`) covers the project's own code and the
contributions made to it. It doesn't say anything about the geodata in this directory.

## Files

| File | Contents | Source | Licence | Used by | History |
|---|---|---|---|---|---|
| `counties.json` | GeoJSON, 3,221 US county polygons. Properties: `name`, `state`, `fips`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.js` (county outlines and shading) and `MT.placeFinders` (placing nodes by county). | Added in `d80920f` (2018-03-05). Minified in `3dcb8ed` (2018-09-27). FIPS check added in `747d7b2` (2019-02-22). |
| `countries.json` | GeoJSON, 180 country polygons. Properties: `name`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.js` (the land, borders and shading) and `MT.placeFinders` (placing nodes by country). | Added in `d80920f`. Minified in `3dcb8ed`. |
| `states.json` | GeoJSON, 52 US state (and territory) polygons. Properties: `name`, `usps`, `_lat`, `_lon`. | Source not recorded. | Not recorded. | `components/geo_map.js` (state outlines and shading) and `MT.placeFinders` (placing nodes by state). | Added in `d80920f`. Minified in `3dcb8ed`. |
| `zipcodes.csv` | ZIP code (`zipcode`) with one latitude and longitude per code (`_lat`, `_lon`). 42,535 rows. | Source not recorded. Converted from a larger GeoJSON in `f618dbb` (2019-01-14, "Converted big GeoJSON to smaller CSV", resolves #91). That GeoJSON isn't in the repository. | Not recorded. | `MT.placeFinders` in `src/loading.js`, which places nodes from their ZIP code field. | Replaced `data/zipcodes.json` in `f618dbb`. |

## Notes

- `zipcodes.csv` holds centroids, not boundaries.
- `data/zipcodes.json`, which `zipcodes.csv` replaced, is still in the git history, before
  `f618dbb`. It has the same content in a different format.
- `tracts.csv` (census tract centroids, also of unrecorded source and licence) was removed, and
  with it placing nodes by census tract.
- `stars.json` (300 stars for the old globe view's background, also of unrecorded source and
  licence) was removed when the globe became a mode of the map.
- Anyone who knows where these files came from, or the licence that applies to them, should record
  it here and in the commit that adds the file.
