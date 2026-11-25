// Geography the map view needs that doesn't touch the page: putting GeoJSON polygons the
// right way round for d3, and upgrading the settings of sessions saved when the map, the
// globe and the choropleth were three views.
//
// An ES module. d3 is the page's global (the primary bundle); the unit tests set it.

// d3 fills a polygon on the side its winding points to, so one wound the other way covers
// the rest of the sphere (as Bermuda's does in countries.json). Reverses, in place, every
// polygon that covers more than half of it, and returns the collection. Doing it twice
// changes nothing.
export function rewind(collection) {
  if (!collection || !Array.isArray(collection.features)) return collection;
  collection.features.forEach(feature => {
    if (!feature || !feature.geometry || d3.geoArea(feature) <= 2 * Math.PI) return;
    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') coordinates.forEach(ring => ring.reverse());
    else if (type === 'MultiPolygon') coordinates.forEach(polygon => polygon.forEach(ring => ring.reverse()));
  });
  return collection;
}

// The kinds of region the map can shade, and the location field each is counted by
export const SHADE_FIELDS = { countries: 'country', states: 'state', counties: 'county' };

// The views a layout saved by MT.cacheLayout holds, in order
export function layoutViews(layout) {
  if (!layout || typeof layout !== 'object') return [];
  if (Array.isArray(layout.content)) return layout.content.flatMap(layoutViews);
  return typeof layout.type === 'string' ? [layout.type] : [];
}

const GLOBE_KEYS = ['field-lat', 'field-lon', 'field-zipcode', 'field-county', 'field-state', 'field-country',
  'node-show', 'link-show', 'node-transparency', 'link-transparency', 'node-jitter', 'countries-show', 'graticule-show'];
const RETIRED = /^(globe|choropleth)-|^map-(basemap|satellite)-show$|^map-collapsing-on$/;

// Upgrades, in place, the settings (session.style.widgets) of a session saved before the
// globe and the choropleth became modes of the map. `views` are the views the session had
// open (and its default view): a globe without a map makes the map a globe, with the
// globe's settings, and a choropleth turns on the map's shading. The choropleth's colors
// become the shading's, and its field the map's field for that kind of region, if the map
// had none. The old settings, and those of the tiles and marker clusters, are dropped.
// Returns whether anything changed.
/* eslint-disable no-restricted-syntax -- a session upgrade, before anything subscribes (as #236 and #249 are) */
export function upgradeMapSettings(widgets, views = []) {
  if (!widgets || !Object.keys(widgets).some(key => RETIRED.test(key))) return false;
  const has = view => views.includes(view);
  const unset = key => [undefined, null, '', 'None'].includes(widgets[key]);

  ['low', 'medium', 'high'].forEach(level => {
    if (widgets['choropleth-color-' + level] !== undefined) widgets['map-shade-color-' + level] = widgets['choropleth-color-' + level];
  });
  if (widgets['choropleth-transparency'] !== undefined) widgets['map-shade-transparency'] = widgets['choropleth-transparency'];
  const regions = SHADE_FIELDS[widgets['choropleth-aggregate-as']] ? widgets['choropleth-aggregate-as'] : 'states';
  const field = widgets['choropleth-aggregate-on'];
  if (!unset('choropleth-aggregate-on') && unset('map-field-' + SHADE_FIELDS[regions])) widgets['map-field-' + SHADE_FIELDS[regions]] = field;
  if (has('choropleth')) widgets['map-shade'] = regions;

  if (has('globe') && !has('geo_map')) {
    GLOBE_KEYS.forEach(key => {
      if (widgets['globe-' + key] !== undefined) widgets['map-' + key] = widgets['globe-' + key];
    });
    widgets['map-projection'] = 'globe';
  }

  Object.keys(widgets).filter(key => RETIRED.test(key)).forEach(key => delete widgets[key]);
  return true;
}
/* eslint-enable no-restricted-syntax */
