(function(){
  'use strict';

  // d3 v6 removed the global d3.event: listeners now get the event as their first
  // argument. MicrobeTrace's own code uses the new form, but TidyTree (the
  // phylogenetic tree view) still reads d3.event in its zoom handler. This sets
  // d3.event while d3 calls a listener, and changes nothing else.
  const wrap = listener => typeof listener != 'function' ? listener : function(event) {
    const previous = d3.event;
    d3.event = event;
    try {
      return listener.apply(this, arguments);
    } finally {
      d3.event = previous;
    }
  };

  const patchOn = target => {
    const on = target.on;
    target.on = function(type, listener) {
      if (arguments.length < 2) return on.apply(this, arguments);
      const result = on.call(this, type, wrap(listener), ...Array.prototype.slice.call(arguments, 2));
      return result === undefined ? this : result;
    };
    return target;
  };

  patchOn(d3.selection.prototype);
  ['zoom', 'drag', 'brush', 'brushX', 'brushY'].forEach(name => {
    const make = d3[name];
    d3[name] = function() {
      return patchOn(make.apply(this, arguments));
    };
  });
})();
