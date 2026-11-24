import { fail } from '../core.js';
import { same } from '../schema.js';
import { viewSchema, openSchema, settle, rootOf, need, settingsOf, publicRecord } from './helpers.js';

const cssColor = value => {
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = '#000001';
  c.fillStyle = String(value);
  const v = c.fillStyle;
  if (v == '#000001' && !/^(#000001|rgb\(0, 0, 1\))$/i.test(String(value))) return null;
  return v.startsWith('#') ? v : null;
};

function coerce(rec, value) {
  const name = '"' + rec.key + '"';
  switch (rec.type) {
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === 'on') return true;
      if (value === 'false' || value === 0 || value === 'off') return false;
      fail(name + ' is on/off: pass true or false');
      break;
    }
    case 'number': {
      const n = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
      if (!isFinite(n)) fail(name + ' needs a number');
      let out = n;
      if (rec.min !== undefined && out < rec.min) out = rec.min;
      if (rec.max !== undefined && out > rec.max) out = rec.max;
      return out;
    }
    case 'choice': {
      const s = String(value);
      const exact = rec.options.find(o => String(o.value) === s);
      const loose = exact || rec.options.find(o => o.label.toLowerCase() == s.toLowerCase() || String(o.value).toLowerCase() == s.toLowerCase());
      if (!loose) fail(name + ' must be one of: ' + rec.options.map(o => JSON.stringify(o.value) + (o.label && o.label != o.value ? ' (' + o.label + ')' : '')).join(', '));
      return loose.value;
    }
    case 'multi-choice': {
      const list = [].concat(value).map(v => {
        const o = rec.options.find(o => String(o.value) === String(v) || o.label.toLowerCase() == String(v).toLowerCase());
        if (!o) fail(name + ' has no option ' + JSON.stringify(v) + '; options: ' + rec.options.map(o => o.value).join(', '));
        return o.value;
      });
      return list;
    }
    case 'color': {
      if (/^#[0-9a-f]{6}$/i.test(value)) return String(value).toLowerCase();
      const hex = cssColor(value);
      if (!hex) fail(name + ' needs a color such as "#ff8800" or "red"');
      return hex;
    }
    default:
      return String(value);
  }
}

export default {
  name: 'set_view_settings',
  title: 'Set view settings',
  description: 'Changes settings of a view; the view redraws. settings is {key: value} using keys from get_view_settings: booleans as true/false, numbers (clamped to min/max), choices as an option value or its label (case-insensitive), colors as "#rrggbb" or a CSS color name. All values are checked first and nothing is applied if any is invalid. Returns each change as from -> to, plus the view\'s settings that are now stored. Note some controls are only meaningful when others are set (see the hidden flag in get_view_settings).',
  inputSchema: {
    type: 'object',
    properties: {
      view: viewSchema,
      open: openSchema,
      settings: { type: 'object', description: 'Setting keys and their new values', additionalProperties: true },
      show: { type: 'boolean', description: 'Bring the view to the front first, so it redraws visibly (default true)' }
    },
    required: ['view', 'settings'],
    additionalProperties: false
  },
  execute: async ({ view, open, settings, show = true }) => {
    const item = await need(view, { open, show });
    const root = rootOf(item);
    const records = settingsOf(root);
    const entries = Object.entries(settings || {});
    if (!entries.length) fail('settings is empty');
    const errors = [], plan = [];
    entries.forEach(([key, value]) => {
      const rec = records.find(r => r.key == key);
      if (!rec) return errors.push('No setting "' + key + '" in the ' + item.componentType + ' view (see get_view_settings)');
      try { plan.push({ rec, key, value: coerce(rec, value) }); } catch (e) { errors.push(e.message); }
    });
    if (errors.length) fail(errors.join('\n'));
    const changes = [];
    for (const { key, value } of plan) {
      const from = self.MT.settings.get(key);
      self.MT.settings.set(key, value);
      changes.push({ key, from: from === undefined ? null : from, to: value, changed: !same(from, value) });
    }
    await settle(150);
    // A control that did not take the value (a view that reads its controls
    // instead of the setting store) is written and told
    plan.forEach(({ rec, value }) => {
      rec._controls.forEach(el => {
        if (!self.MTBind) return;
        if (el.tagName === 'SELECT' && el.multiple) return;
        const now = el.type == 'radio' ? (el.checked ? self.MTBind.read(el) : undefined) : self.MTBind.read(el);
        const shown = el.type == 'radio' ? el.checked === (self.MTBind.read(el) === value) : same(now, value);
        if (!shown) {
          self.MTBind.write(el, value);
          const type = el.type == 'range' || el.type == 'number' || el.type == 'text' ? 'input' : 'change';
          if (el.type != 'radio' || el.checked) el.dispatchEvent(new Event(type, { bubbles: true }));
        }
      });
    });
    await settle(100);
    const after = settingsOf(root).filter(r => plan.some(p => p.key == r.key)).map(publicRecord);
    return { view: item.componentType, changes, settings: after };
  }
};
