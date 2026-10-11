(function(self){
  'use strict';

  // MTSettings: MicrobeTrace's settings as one observable store.
  //
  // The values live where they always have, in session.style.widgets, so saved
  // and stashed sessions keep working; `source` returns that object (it is
  // replaced whenever a session is loaded). Views read with get(), write with
  // set(), and subscribe() to the keys they draw from, instead of reading
  // settings back from the DOM or listening for each other's clicks.
  //
  // Code that still writes session.style.widgets directly doesn't notify
  // subscribers; it is being moved onto set() view by view.

  class MTSettings {
    constructor(source) {
      this.source = source;
      this.subscribers = new Map();
    }

    get(key) {
      return this.source()[key];
    }

    // Stores a value and notifies the key's subscribers, if it changed.
    set(key, value) {
      const values = this.source();
      if (values[key] === value) return;
      values[key] = value;
      this.notify(key);
    }

    // Calls fn(value, key) whenever one of the keys is set. Returns a function
    // that unsubscribes. With { reload: true }, fn is also called by reload().
    subscribe(keys, fn, { reload = false } = {}) {
      keys = [].concat(keys);
      if (reload) fn.reload = true;
      keys.forEach(key => {
        if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
        this.subscribers.get(key).add(fn);
      });
      return () => keys.forEach(key => this.subscribers.get(key).delete(fn));
    }

    notify(key, only) {
      const fns = this.subscribers.get(key);
      if (!fns) return;
      const value = this.get(key);
      // A subscriber may unsubscribe (or subscribe others) while being called
      Array.from(fns).filter(fn => !only || only(fn)).forEach(fn => fn(value, key));
    }

    // After every value has been replaced at once (a session or style was
    // loaded), calls the subscribers that asked to hear it: the controls showing
    // the values, not the code that acts on each change.
    reload() {
      Array.from(this.subscribers.keys()).forEach(key => this.notify(key, fn => fn.reload));
    }
  }

  self.MTSettings = MTSettings;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTSettings;
})(typeof self !== 'undefined' ? self : this);
