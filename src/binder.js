(function(self){
  'use strict';

  // MTBind(root, settings): connects the form controls inside root to settings.
  //
  // A control names the setting it shows with data-setting:
  //
  //   <select data-setting="histogram-variable">…</select>
  //   <input type="range" data-setting="node-radius">
  //   <input type="checkbox" data-setting="polygons-show">
  //   <input type="radio" name="axis" data-setting="histogram-axis-x" value="true"> X
  //   <input type="radio" name="axis" data-setting="histogram-axis-x" value="false"> Y
  //
  // The binder shows the stored value in each control, stores the user's changes,
  // and updates the controls when the setting is changed elsewhere. Values keep
  // their types: number and range inputs store numbers, checkboxes booleans, and
  // radio values "true"/"false" booleans. A setting with no stored value yet
  // takes the control's initial value. Text, number and range inputs store each
  // edit as it's made, unless they say data-setting-on="change" (for settings
  // that are slow to apply). Toggle-button groups (.btn-group-toggle)
  // have their .active labels kept in step.
  //
  // Returns a function that disconnects everything.

  const parseRadio = value => value == 'true' ? true : value == 'false' ? false : value;

  // A control's value, typed
  function read(el) {
    if (el.type == 'checkbox') return el.checked;
    if (el.type == 'radio') return parseRadio(el.value);
    if (el.type == 'number' || el.type == 'range') return el.value === '' ? null : Number(el.value);
    return el.value;
  }

  function write(el, value) {
    if (el.type == 'checkbox') el.checked = !!value;
    else if (el.type == 'radio') el.checked = parseRadio(el.value) === value;
    else el.value = value == null ? '' : value;
    syncToggleGroup(el);
  }

  function syncToggleGroup(el) {
    const group = el.closest && el.closest('.btn-group-toggle');
    if (!group) return;
    group.querySelectorAll('.btn > input').forEach(input => input.parentElement.classList.toggle('active', input.checked));
  }

  function MTBind(root, settings) {
    const controls = Array.from(root.querySelectorAll('[data-setting]'));
    const keys = new Map();
    controls.forEach(el => {
      const key = el.dataset.setting;
      if (!keys.has(key)) keys.set(key, []);
      keys.get(key).push(el);
    });

    const cleanup = [];
    keys.forEach((els, key) => {
      if (settings.get(key) === undefined) {
        const initial = els.find(el => el.type != 'radio' || el.checked);
        if (initial) settings.set(key, read(initial));
      }
      const show = value => els.forEach(el => write(el, value));
      show(settings.get(key));
      cleanup.push(settings.subscribe(key, show, { reload: true }));

      els.forEach(el => {
        const live = el.type == 'range' || el.type == 'number' || el.type == 'text' || el.tagName == 'TEXTAREA';
        // data-setting-on="change" waits for the edit to be committed
        const type = el.dataset.settingOn || (live ? 'input' : 'change');
        const listener = () => {
          // A radio's change event fires only on the one being checked
          if (el.type == 'radio' && !el.checked) return;
          settings.set(key, read(el));
          syncToggleGroup(el);
        };
        el.addEventListener(type, listener);
        cleanup.push(() => el.removeEventListener(type, listener));
      });
    });

    return () => cleanup.forEach(fn => fn());
  }

  MTBind.read = read;
  MTBind.write = write;

  self.MTBind = MTBind;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTBind;
})(typeof self !== 'undefined' ? self : this);
