(function(self){
  'use strict';

  // MTSessionFormat: the version of the saved-session format and a check that
  // a parsed file really is a session we can open (#226). Run it before the
  // current session is replaced, so a wrong file leaves it untouched.
  //
  // Sessions saved before there was a version have no formatVersion: they are
  // version 0, and open as they always have. Raise CURRENT_VERSION when a
  // change makes new sessions unreadable by older code.

  const CURRENT_VERSION = 1;

  const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  // Returns { ok: true, version } or { ok: false, error: 'message for the user' }
  function validate(session) {
    if (!isObject(session)) return { ok: false, error: 'This file is not a MicrobeTrace session.' };
    if (session.trace_results || session.samples) {
      return { ok: false, error: 'This file is HIV-TRACE or GHOST output, not a MicrobeTrace session.' };
    }
    let version = 0;
    if (session.formatVersion !== undefined) {
      version = session.formatVersion;
      if (!Number.isInteger(version) || version < 0) {
        return { ok: false, error: 'This session file has an invalid format version (' + JSON.stringify(version) + ').' };
      }
      if (version > CURRENT_VERSION) {
        return { ok: false, error: 'This session was saved by a newer version of MicrobeTrace (session format ' + version +
          '; this version understands up to ' + CURRENT_VERSION + '). Reload the page to get the latest version, then try again.' };
      }
    }
    if (!isObject(session.data)) return { ok: false, error: 'This file is not a MicrobeTrace session: it has no "data".' };
    if (!Array.isArray(session.data.nodes)) return { ok: false, error: 'This file is not a valid MicrobeTrace session: its data has no list of nodes.' };
    if (!Array.isArray(session.data.links)) return { ok: false, error: 'This file is not a valid MicrobeTrace session: its data has no list of links.' };
    for (const part of ['style', 'state', 'layout', 'network']) {
      if (session[part] !== undefined && !isObject(session[part])) {
        return { ok: false, error: 'This file is not a valid MicrobeTrace session: "' + part + '" is malformed.' };
      }
    }
    if (session.files !== undefined && !Array.isArray(session.files)) {
      return { ok: false, error: 'This file is not a valid MicrobeTrace session: "files" is malformed.' };
    }
    return { ok: true, version };
  }

  const MTSessionFormat = { CURRENT_VERSION, validate };
  self.MTSessionFormat = MTSessionFormat;
  if (typeof module !== 'undefined' && module.exports) module.exports = MTSessionFormat;
})(typeof self !== 'undefined' ? self : this);
