// Lightweight IndexedDB wrapper — replaces localforage.
// API matches localforage's core methods:
//   db.getItem(key)         → Promise(value)
//   db.setItem(key, value)  → Promise(undefined), once the write has committed
//                             (rejects if it fails, e.g. QuotaExceededError)
//   db.removeItem(key)      → Promise(undefined), once the removal has committed
//   db.keys()               → Promise([string])
//
// All values are JSON-serialized. Dates are preserved via toJSON.

(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : globalThis;
  var DB_NAME = 'MicrobeTrace';
  var DB_STORE = 'items';
  var DB_VERSION = 1;
  var _db; // Promise<IDBDatabase>

  function openDB() {
    if (_db) return _db;
    _db = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { _db = undefined; reject(e.target.error); };
    });
    return _db;
  }

  // Resolves once the transaction has committed (with the request's result),
  // and rejects, with the error, if it fails or aborts (as it does when the
  // storage quota is exceeded).
  function tx(mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t, request;
        try {
          t = db.transaction(DB_STORE, mode);
          t.oncomplete = function () { resolve(request ? request.result : undefined); };
          t.onerror = function () { reject((request && request.error) || t.error); };
          t.onabort = function () { reject(t.error || (request && request.error) || new Error('The transaction was aborted')); };
          request = fn(t.objectStore(DB_STORE));
        } catch (error) {
          try { if (t) t.abort(); } catch (ignored) { /* already finished */ }
          reject(error);
        }
      });
    });
  }

  var db = {
    getItem: function (key) {
      return tx('readonly', function (store) { return store.get(key); });
    },
    setItem: function (key, value) {
      return tx('readwrite', function (store) { return store.put(value, key); });
    },
    removeItem: function (key) {
      return tx('readwrite', function (store) { return store.delete(key); });
    },
    keys: function () {
      return tx('readonly', function (store) {
        return store.getAllKeys();
      });
    }
  };

  // Deletes the whole database (stashes, autostashes, the accepted license
  // and the settings kept with them). Resolves once it is gone.
  db.deleteAll = function () {
    var open = _db;
    _db = undefined;
    return (open ? open.then(function (d) { d.close(); }, function () {}) : Promise.resolve()).then(function () {
      return new Promise(function (resolve, reject) {
        var req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = function () { resolve(); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('Another MicrobeTrace tab is open; close it and try again.')); };
      });
    });
  };

  // A sentence on why a write failed, for the user
  db.describeError = function (error) {
    if (error && (error.name === 'QuotaExceededError' || error.name === 'QuotaExceeded')) {
      return 'This browser has no room left to keep it. Delete old stashes (File > Recall from Browser) or save a file instead.';
    }
    return (error && error.message) || 'The browser refused to store it.';
  };

  root.db = db;
})();
