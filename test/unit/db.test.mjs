// src/db.js: writes resolve only once the transaction commits, and reject when
// it aborts (#225). Run against a small hand-rolled fake of IndexedDB, in which
// a transaction commits (or aborts) on a later tick, as a real one does.
import test from 'node:test';
import assert from 'node:assert';

function fakeIndexedDB({ failWith } = {}) {
  const data = new Map();
  const state = { data, failWith, committed: 0 };
  const database = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const pending = [];
      const t = {
        oncomplete: null, onerror: null, onabort: null, error: null,
        abort() { t.error = t.error || new Error("aborted"); setTimeout(() => t.onabort && t.onabort()); },
        objectStore() {
          const request = work => {
            const r = { result: undefined, error: null };
            pending.push(() => { r.result = work(); });
            return r;
          };
          return {
            get: key => request(() => data.get(key)),
            getAllKeys: () => request(() => [...data.keys()]),
            put: (value, key) => request(() => { data.set(key, value); }),
            delete: key => request(() => { data.delete(key); })
          };
        }
      };
      setTimeout(() => {
        if (state.failWith) {
          t.error = state.failWith;
          return t.onabort && t.onabort();
        }
        pending.forEach(run => run());
        state.committed++;
        t.oncomplete && t.oncomplete();
      }, 5);
      return t;
    }
  };
  return {
    state,
    open() {
      const req = {};
      setTimeout(() => { req.onsuccess && req.onsuccess({ target: { result: database } }); });
      return req;
    }
  };
}

// Each load imports a fresh copy of the module (the query makes it a new one),
// so every test starts with no open database
let loads = 0;
async function load(options) {
  const idb = fakeIndexedDB(options);
  globalThis.indexedDB = idb;
  const { db } = await import("../../src/db.js?load=" + ++loads);
  return { db, state: idb.state };
}

test("setItem resolves only after the transaction has committed", async () => {
  const { db, state } = await load();
  let resolved = false;
  const pending = db.setItem("a", "1").then(() => { resolved = true; });
  await new Promise(resolve => setTimeout(resolve, 1));
  assert.strictEqual(resolved, false, "resolved before the commit");
  await pending;
  assert.strictEqual(state.committed, 1);
  assert.strictEqual(await db.getItem("a"), "1");
});

test("removeItem resolves only after the commit, and keys and getItem still work", async () => {
  const { db, state } = await load();
  await db.setItem("a", "1");
  await db.setItem("b", "2");
  assert.deepStrictEqual(await db.keys(), ["a", "b"]);
  await db.removeItem("a");
  assert.strictEqual(state.data.has("a"), false);
  assert.deepStrictEqual(await db.keys(), ["b"]);
});

test("a failed write rejects with the transaction's error", async () => {
  const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
  const { db, state } = await load({ failWith: quota });
  await assert.rejects(db.setItem("a", "1"), error => error === quota);
  await assert.rejects(db.removeItem("a"), error => error === quota);
  assert.strictEqual(state.data.size, 0);
  assert.match(db.describeError(quota), /no room/);
});
