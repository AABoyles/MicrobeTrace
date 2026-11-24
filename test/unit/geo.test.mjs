// Unit tests for src/geo.js: winding polygons for d3, and upgrading the settings of
// sessions saved when the map, the globe and the choropleth were three views.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert';
import * as d3 from 'd3';

globalThis.d3 = d3;
const { rewind, layoutViews, upgradeMapSettings } = await import('../../src/geo.js');

const square = ring => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });
// A degree square, wound as d3 wants (clockwise on screen) and the other way
const right = () => square([[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]);
const wrong = () => square([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);

test('rewind turns polygons that cover most of the sphere, and only those, and twice changes nothing', () => {
  const collection = { type: 'FeatureCollection', features: [right(), wrong()] };
  assert.ok(d3.geoArea(collection.features[1]) > 2 * Math.PI);
  rewind(collection);
  collection.features.forEach(f => assert.ok(d3.geoArea(f) < 0.01));
  const once = JSON.stringify(collection);
  rewind(collection);
  assert.strictEqual(JSON.stringify(collection), once);
});

test('rewind turns each polygon of a multipolygon, and leaves points and odd input alone', () => {
  const multi = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [wrong().geometry.coordinates] } };
  const point = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [1, 2] } };
  rewind({ features: [multi, point, null, { geometry: null }] });
  assert.ok(d3.geoArea(multi) < 0.01);
  assert.deepStrictEqual(point.geometry.coordinates, [1, 2]);
  assert.strictEqual(rewind(null), null);
  assert.deepStrictEqual(rewind({}), {});
});

test('layoutViews lists the views of a saved layout', () => {
  const layout = { type: 'row', content: [{ type: 'network' }, { type: 'stack', content: [{ type: 'globe' }, { type: 'table' }] }] };
  assert.deepStrictEqual(layoutViews(layout), ['network', 'globe', 'table']);
  assert.deepStrictEqual(layoutViews(null), []);
  assert.deepStrictEqual(layoutViews({ type: 'stack', content: [] }), []);
});

// The settings a session saved before the change had, with the defaults of the day
const old = extra => ({
  'map-field-lat': 'None', 'map-field-state': 'None', 'map-node-transparency': 0, 'map-collapsing-on': true,
  'map-basemap-show': false, 'map-satellite-show': true,
  'globe-field-lat': 'lat', 'globe-node-transparency': 0.4, 'globe-stars-show': true, 'globe-graticule-show': true,
  'choropleth-aggregate-as': 'states', 'choropleth-aggregate-on': 'home_state', 'choropleth-color-high': '#0000ff',
  'choropleth-color-low': '#ffffcc', 'choropleth-color-medium': '#fd8d3c', 'choropleth-transparency': 0.6,
  'link-color': '#123456',
  ...extra
});
const retired = widgets => Object.keys(widgets).filter(k => /^(globe|choropleth)-|^map-(basemap|satellite)-show$|^map-collapsing-on$/.test(k));

test('a session with the map only keeps its map settings, and gains the choropleth\'s colors and field', () => {
  const widgets = old();
  assert.strictEqual(upgradeMapSettings(widgets, ['network', 'geo_map']), true);
  assert.deepStrictEqual(retired(widgets), []);
  assert.strictEqual(widgets['map-field-lat'], 'None');
  assert.strictEqual(widgets['map-node-transparency'], 0);
  assert.strictEqual(widgets['map-projection'], undefined);
  assert.strictEqual(widgets['map-shade'], undefined, 'no choropleth was open');
  assert.strictEqual(widgets['map-shade-color-high'], '#0000ff');
  assert.strictEqual(widgets['map-shade-transparency'], 0.6);
  assert.strictEqual(widgets['map-field-state'], 'home_state');
  assert.strictEqual(widgets['link-color'], '#123456');
});

test('a session with a globe and no map opens the map as a globe, with the globe\'s settings', () => {
  const widgets = old();
  upgradeMapSettings(widgets, ['network', 'globe']);
  assert.strictEqual(widgets['map-projection'], 'globe');
  assert.strictEqual(widgets['map-field-lat'], 'lat');
  assert.strictEqual(widgets['map-node-transparency'], 0.4);
  assert.strictEqual(widgets['map-graticule-show'], true);
  assert.deepStrictEqual(retired(widgets), []);
});

test('a globe beside a map leaves the map as it was', () => {
  const both = old();
  upgradeMapSettings(both, ['geo_map', 'globe']);
  assert.strictEqual(both['map-projection'], undefined);
  assert.strictEqual(both['map-field-lat'], 'None');
});

test('a session with a choropleth shades the regions it shaded', () => {
  const widgets = old({ 'choropleth-aggregate-as': 'counties', 'choropleth-aggregate-on': 'fips' });
  upgradeMapSettings(widgets, ['choropleth']);
  assert.strictEqual(widgets['map-shade'], 'counties');
  assert.strictEqual(widgets['map-field-county'], 'fips');
});

test('the choropleth\'s field doesn\'t replace a field the map already had', () => {
  const widgets = old({ 'map-field-state': 'state' });
  upgradeMapSettings(widgets, ['choropleth']);
  assert.strictEqual(widgets['map-field-state'], 'state');
});

test('a session saved since changes nothing', () => {
  const widgets = { 'map-projection': 'globe', 'map-shade': 'states', 'link-color': '#000000' };
  const before = JSON.stringify(widgets);
  assert.strictEqual(upgradeMapSettings(widgets, ['geo_map']), false);
  assert.strictEqual(JSON.stringify(widgets), before);
});
