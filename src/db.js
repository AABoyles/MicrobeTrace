// Lightweight IndexedDB wrapper — replaces localforage.
// API matches localforage's core methods:
//   db.getItem(key)         → Promise(value)
//   db.setItem(key, value)  → Promise(undefined)
//   db.removeItem(key)      → Promise(undefined)
//   db.keys()               → Promise([string])
//
// All values are JSON-serialized. Dates are preserved via toJSON.

(function () {
  'use strict';

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
      req.onerror = function (e) { reject(e.target.error); };
    });
    return _db;
  }

  function tx(mode, fn) {
    return openDB().then(function (db) {
      var store = db.transaction(DB_STORE, mode).objectStore(DB_STORE);
      return new Promise(function (resolve, reject) {
        var result = fn(store);
        if (result && typeof result.addEventListener === 'function') {
          // It's an IDBRequest
          result.onsuccess = function () { resolve(result.result); };
          result.onerror = function () { reject(result.error); };
        } else {
          resolve(result);
        }
      });
    });
  }

  var db = {
    getItem: function (key) {
      return tx('readonly', function (store) { return store.get(key); });
    },
    setItem: function (key, value) {
      return tx('readwrite', function (store) {
        store.put(value, key);
      });
    },
    removeItem: function (key) {
      return tx('readwrite', function (store) {
        store.delete(key);
      });
    },
    keys: function () {
      return tx('readonly', function (store) {
        return store.getAllKeys();
      });
    }
  };

  window.db = db;
})();
