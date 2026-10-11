(function(self){
  'use strict';

  // MTEvents: the app-wide events views use to tell each other about changes.
  //
  //   const off = events.on('node-color-change', () => redraw());
  //   events.emit('node-selected');
  //
  // Each event is listed below with what it means.

  const EVENTS = {
    'node-color-change': 'node colors (variable, palette or values) changed',
    'link-color-change': 'link colors changed',
    'background-color-change': 'the background color changed',
    'selected-color-change': 'the color of selected nodes changed',
    'node-border-change': 'node border color or width changed',
    'node-selected': 'the selected nodes changed (detail: the view that changed them, if one did)',
    'node-visibility': 'which nodes are visible changed',
    'link-visibility': 'which links are visible changed',
    'cluster-visibility': 'which clusters are visible changed',
    'stop-force-simulation': 'the network layout should stop (a new session is replacing this one)'
  };

  class MTEvents {
    constructor() {
      this.target = new EventTarget();
    }

    // Calls fn(detail) on each event of this type. Returns a function that stops.
    on(type, fn) {
      if (!(type in EVENTS)) throw new Error('Unknown MicrobeTrace event: ' + type);
      const listener = e => fn(e.detail === null ? undefined : e.detail);
      this.target.addEventListener(type, listener);
      return () => this.target.removeEventListener(type, listener);
    }

    emit(type, detail) {
      if (!(type in EVENTS)) throw new Error('Unknown MicrobeTrace event: ' + type);
      this.target.dispatchEvent(new CustomEvent(type, { detail }));
    }
  }

  MTEvents.EVENTS = EVENTS;

  self.MTEvents = MTEvents;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTEvents;
})(typeof self !== 'undefined' ? self : this);
