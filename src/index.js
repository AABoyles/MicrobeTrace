// MicrobeTrace's page: the menus, the global settings, the color tables and
// network statistics, the global timeline and search. The views are in
// components/; what they share is in src/common.js.
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const byId = id => document.getElementById(id);
  const all = selector => Array.from(document.querySelectorAll(selector));
  const on = (id, type, fn) => byId(id).addEventListener(type, fn);
  const modal = (id, options) => bootstrap.Modal.getOrCreateInstance(byId(id), options);
  const escape = value => String(value).replace(/[&<>'"/\\]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;", "\\": "&#x5C;" })[c]);
  MT.escape = escape;

  // The link in the notice shown when the stylesheets don't load
  byId("reload-link").addEventListener("click", e => { e.preventDefault(); location.reload(); });

  // The features the app needs from startup on: WebAssembly (the distance
  // workers), Web Workers (every computation) and IndexedDB (stashed sessions
  // and the license). WebGL is only needed when the 2D network opens, which
  // reports its own failure, so it isn't checked here (#232).
  const missing = [];
  if (typeof WebAssembly === "undefined") missing.push("WebAssembly");
  if (typeof Worker === "undefined") missing.push("Web Workers");
  if (typeof indexedDB === "undefined") missing.push("IndexedDB");
  if (missing.length) {
    byId("unsupported-features").textContent = " (it lacks " + missing.join(", ") + ")";
    byId("unsupported-browser").classList.add("shown");
    throw new Error("MicrobeTrace needs " + missing.join(", ") + ", which this browser lacks.");
  } else {
    byId("unsupported-browser").remove();
  }

  // Mark local and preview deployments, so they aren't mistaken for the real site
  MT.isDevelopmentHost = host => host === "localhost" || host === "127.0.0.1" || /-git-.+\.vercel\.app$/.test(host);
  byId("development-version").hidden = !MT.isDevelopmentHost(location.hostname);

  // Before anything else gets done, ask the user to accept the legal agreement
  db.getItem("licenseAccepted").then(function(accepted) {
    if (!accepted) {
      on("acceptAgreement", "click", function() { db.setItem("licenseAccepted", new Date()); });
      modal("licenseAgreement", { backdrop: "static", keyboard: false }).show();
    }
  });

  on("rejectAgreement", "click", function() { byId("reject-message").hidden = false; });

  // Delete everything this app keeps in the browser (#262)
  on("delete-everything", "click", function() {
    byId("delete-everything-error").hidden = true;
    modal("about-modal").hide();
    modal("delete-everything-modal").show();
  });
  on("delete-everything-confirm", "click", async function() {
    const button = byId("delete-everything-confirm");
    button.disabled = true;
    try {
      if (self.temp && self.temp.autostash) clearInterval(self.temp.autostash.interval);
      await db.deleteAll();
      try { localStorage.clear(); } catch { /* unavailable */ }
      try { sessionStorage.clear(); } catch { /* unavailable */ }
      if (self.caches) await caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
      if (navigator.serviceWorker) await navigator.serviceWorker.getRegistrations().then(all => Promise.all(all.map(r => r.unregister())));
      if (navigator.storage && navigator.storage.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
      }
      MT.reload();
    } catch (error) {
      button.disabled = false;
      const message = byId("delete-everything-error");
      message.textContent = "Couldn't delete everything: " + ((error && error.message) || error);
      message.hidden = false;
    }
  });

  if ("serviceWorker" in navigator) {
    // A new version is installed in the background but waits, so a session in
    // progress isn't swapped under the user: they choose when to reload (#194)
    // (The first install claims the page too; that needs no reload.)
    let reloading = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
    const offerUpdate = worker => {
      MT.toast.info("A new version is available. Click here to reload (unsaved work will be lost).", 0, clicked => {
        if (clicked) worker.postMessage({ type: "SKIP_WAITING" });
      }, { action: "Reload" });
    };
    navigator.serviceWorker.register("sw.js").then(registration => {
      if (!registration) return;
      // Only an update has a controller already; the first install needs no prompt
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
    }).catch(error => {
      console.error("Service Worker Registration failed with " + error);
    });
  }

  MT.resetSession();
  MT.createLayout();

  const settings = MT.settings, events = MT.events;
  const get = key => settings.get(key);

  // The page starts below the menu bar, however many rows it wraps onto
  const navbar = document.querySelector("nav.navbar");
  new ResizeObserver(() => {
    document.body.style.setProperty("--navbar-height", navbar.offsetHeight + "px");
  }).observe(navbar);

  // Dialogs can be dragged by their headers
  document.addEventListener("mousedown", e => {
    const header = e.target.closest && e.target.closest(".modal-header");
    if (!header || e.target.closest("button")) return;
    const dialog = header.closest(".modal");
    const move = e => {
      dialog.style.top = (parseFloat(getComputedStyle(dialog).top) + e.movementY) + "px";
      dialog.style.left = (parseFloat(getComputedStyle(dialog).left) + e.movementX) + "px";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", () => document.removeEventListener("mousemove", move), { once: true });
  });

  // The menus ---------------------------------------------------------------

  const stashSession = name => {
    MT.syncLayout();
    return db.setItem("stash-" + Date.now() + "-" + name, JSON.stringify(session))
      .then(() => MT.toast.success("Stashed in this browser"), error => {
        console.error(error);
        MT.toast.error("Couldn't stash the session: " + MT.escape(db.describeError(error)), 15);
        throw error;
      });
  };
  on("stash-data", "click", () => stashSession(byId("stash-name").value));

  // Replacing the session (Open, Recall, a dropped session file) asks first,
  // when there is something to lose. There is no tracking of unsaved changes,
  // so that is any data loaded: a session with none has nothing to lose.
  // `cancelled` is told when the answer is no.
  MT.confirmReplace = (replace, cancelled) => {
    if (!session.data.nodes.length) return replace();
    let answer = "cancel";
    const dialog = byId("replace-modal");
    const choose = choice => () => { answer = choice; };
    const choices = [["replace-button", "replace"], ["replace-stash-first", "stash"]].map(([id, choice]) => {
      const handler = choose(choice);
      byId(id).addEventListener("click", handler);
      return [id, handler];
    });
    dialog.addEventListener("hidden.bs.modal", () => {
      choices.forEach(([id, handler]) => byId(id).removeEventListener("click", handler));
      if (answer === "replace") replace();
      else if (answer === "stash") stashSession("Before replacing, " + new Date().toLocaleString()).then(replace, () => MT.toast.error("Couldn't stash the current session, so it was kept."));
      else if (cancelled) cancelled();
    }, { once: true });
    // (Escape and the backdrop dismiss it: Cancel)
    modal("replace-modal", { backdrop: true, keyboard: true }).show();
  };

  // Stashes are kept as stash-<when>-<name>, newest listed first
  const stashOf = key => {
    const parts = /^stash-(\d+)-([\s\S]*)$/.exec(key);
    return parts && { key, time: +parts[1], name: parts[2] };
  };
  const stashName = stash => stash.name || "Untitled";
  // Tabulator is fetched when the Recall dialog is first opened (#324)
  let stashes = null;
  const stashOptions = {
    maxHeight: "50vh",
    layout: "fitColumns",
    selectableRows: 1,
    placeholder: "Nothing is stashed in this browser yet. Stash a session from the File menu.",
    initialSort: [{ column: "time", dir: "desc" }],
    // (Columns resized from the cells would take the clicks choosing a stash)
    columnDefaults: { resizable: false },
    columns: [
      { title: "Name", field: "name", formatter: cell => cell.getValue() ? MT.escape(cell.getValue()) : '<span class="text-muted">Untitled</span>' },
      {
        title: "Stashed", field: "time", width: 190, hozAlign: "right", sorter: "number",
        formatter: cell => MT.escape(new Date(cell.getValue()).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))
      }
    ]
  };

  const selectedStash = () => stashes && stashes.getSelectedData()[0];
  // Recall and Delete act on the stash chosen
  const showChoice = () => ["recall-load-stash", "recall-delete-stash"].forEach(id => { byId(id).disabled = !selectedStash(); });
  const buildStashes = () => MT.loadLibrary("table").then(() => {
    if (stashes) return;
    stashes = MT.table("#recall-stashes-available", stashOptions);
    stashes.on("rowSelectionChanged", showChoice);
    stashes.on("rowDblClick", (e, row) => recall(row.getData()));
  });
  function updateStashes() {
    return buildStashes().then(() => db.keys())
      .then(keys => stashes.setData(keys.map(stashOf).filter(Boolean)))
      .then(showChoice);
  }

  function recall(stash) {
    db.getItem(stash.key).then(json => {
      const data = JSON.parse(json);
      const load = () => {
        // A stash that is not a valid session is refused (with a message), and Recall stays open
        if (MT.applySession(data)) modal("session-recall-modal").hide();
      };
      if (!session.data.nodes.length) return load();
      // Ask once the Recall dialog is out of the way (and bring it back on Cancel)
      const recallDialog = byId("session-recall-modal");
      recallDialog.addEventListener("hidden.bs.modal", () =>
        MT.confirmReplace(load, () => modal("session-recall-modal").show()), { once: true });
      modal("session-recall-modal").hide();
    }).catch(error => {
      console.error(error);
      MT.toast.error(`"${MT.escape(stashName(stash))}" couldn't be recalled.`);
    });
  }

  on("RecallDataTab", "click", e => {
    e.preventDefault();
    updateStashes().catch(error => {
      console.error(error);
      MT.toast.error("The list of stashed sessions couldn't be loaded. Check your connection and try again.");
    });
    modal("session-recall-modal").show();
  });
  // (The table is drawn while the dialog is hidden)
  on("session-recall-modal", "shown.bs.modal", () => stashes && stashes.redraw());

  on("recall-load-stash", "click", () => {
    const stash = selectedStash();
    if (stash) recall(stash);
  });

  // Deleting can be undone, for a while
  on("recall-delete-stash", "click", () => {
    const stash = selectedStash();
    if (!stash) return;
    db.getItem(stash.key)
      .then(json => db.removeItem(stash.key).then(() => json))
      .then(json => {
        updateStashes();
        MT.toast.warning(`Deleted "${MT.escape(stashName(stash))}". Click here to undo.`, 10, clicked => {
          if (clicked) db.setItem(stash.key, json).then(updateStashes);
        }, { action: "Undo" });
      });
  });

  // Recovering an autostashed session ---------------------------------------
  // An autostash copy that is still here at startup is work that was not
  // closed out (or a session left running): offer to restore or discard it,
  // once the license has been dealt with. "Decide Later" keeps it.
  const autostashes = () => db.keys().then(keys => keys.filter(key => /^stash-\d+-autostash$/.test(key)).sort((a, b) => stashOf(b).time - stashOf(a).time));
  const offerRecovery = () => autostashes().then(keys => {
    if (!keys.length) return;
    const newest = keys[0];
    let answer = "later";
    const choose = choice => () => { answer = choice; };
    const restore = choose("restore"), discard = choose("discard");
    byId("recover-restore").addEventListener("click", restore);
    byId("recover-discard").addEventListener("click", discard);
    byId("recover-when").textContent = new Date(stashOf(newest).time).toLocaleString();
    const dialog = byId("recover-modal");
    // The primary action has the focus, so Enter restores and Escape decides later
    dialog.addEventListener("shown.bs.modal", () => byId("recover-restore").focus(), { once: true });
    dialog.addEventListener("hidden.bs.modal", () => {
      byId("recover-restore").removeEventListener("click", restore);
      byId("recover-discard").removeEventListener("click", discard);
      if (answer === "discard") {
        Promise.all(keys.map(key => db.removeItem(key)))
          .then(() => MT.toast.success("Discarded the recovery copy"), error => {
            console.error(error);
            MT.toast.error("Couldn't discard the recovery copy: " + escape(db.describeError(error)), 15);
          });
      } else if (answer === "restore") {
        // Keep the copy as an ordinary stash (so it is not offered again, and
        // is still there if the restore goes wrong), written before the
        // autostash copy is removed
        db.getItem(newest).then(json => {
          const data = JSON.parse(json);
          return db.setItem("stash-" + Date.now() + "-Recovered session", json)
            .then(() => Promise.all(keys.map(key => db.removeItem(key))))
            .then(() => {
              // (applySession says why when it refuses the copy, which stays in Recall)
              if (MT.applySession(data)) MT.toast.success("Restored your previous session");
            });
        }).catch(error => {
          console.error(error);
          MT.toast.error("The recovery copy couldn't be restored: " + escape(db.describeError(error)) + " It was kept (File > Recall from Browser).", 15);
        });
      }
    }, { once: true });
    modal("recover-modal", { backdrop: "static", keyboard: true }).show();
  }).catch(error => console.error("Couldn't look for a recovery copy:", error));
  // (After the license agreement: the two dialogs would stack)
  db.getItem("licenseAccepted").then(accepted => {
    if (accepted) return offerRecovery();
    byId("licenseAgreement").addEventListener("hidden.bs.modal", offerRecovery, { once: true });
  });

  MT.defaultFilename(byId("save-file-name"));

  // The text a save writes, in one of the Save dialog's formats
  MT.sessionText = format => {
    if (format === "hivtrace") return MT.exportHIVTRACE();
    MT.syncLayout();
    return JSON.stringify(session);
  };

  // Saves data (by default the session in format) as name.format, or name.zip
  // when compress is on. An empty or hidden-file name, or a typed extension, is
  // put right; with no name, the Save dialog's file name is used. Resolves to the
  // file's name. (WebMCP's save_session saves through this too.)
  MT.saveSession = async ({ format = "microbetrace", name, compress = false, data = MT.sessionText(format) } = {}) => {
    const file = MT.cleanFilename(name === undefined ? byId("save-file-name").value : name, ["zip", "microbetrace", "hivtrace", "json"]);
    if (compress) {
      await MT.loadLibrary("xlsx");
      const zip = new JSZip();
      zip.file(file + "." + format, data);
      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });
      MT.saveAs(content, file + ".zip");
      return file + ".zip";
    }
    MT.exportBlob(data, 'application/json', file + "." + format);
    return file + "." + format;
  };

  on("save-data", "click", () => {
    const compress = byId("save-file-compress").checked;
    MT.saveSession({ format: byId("save-file-format").value, compress }).then(file => MT.toast.success("Saved as " + MT.escape(file)), error => {
      console.error(error);
      MT.toast.error(compress ? "The file couldn't be compressed. Try again with \"Compress the file\" unticked." : "The file couldn't be saved.");
    });
  });

  // File > Open: a button (it can take focus) that opens the file input's picker
  on("OpenButton", "click", () => byId("OpenTab").click());
  // The skip link moves focus to the main region (a bare #main-panel link
  // would also change the address, which a "#demo" start reads)
  on("skip-link", "click", e => {
    e.preventDefault();
    byId("main-panel").focus();
  });
  on("OpenTab", "change", e => {
    const [file] = e.target.files;
    // (So choosing the same file again, after cancelling, is a change)
    e.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    MT.confirmReplace(() => {
      if (extension === "zip") {
        MT.loadLibrary("xlsx").then(() => new JSZip().loadAsync(file)).then(zip => {
          const entries = [];
          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && /\.(microbetrace|hivtrace|json)$/i.test(zipEntry.name)) entries.push(zipEntry);
          });
          if (!entries.length) return MT.toast.error('"' + MT.escape(file.name) + '" has no MicrobeTrace session in it. Open a .zip made by File > Save, or open the .microbetrace file itself.');
          entries.forEach(zipEntry => zipEntry.async("string").then(c => MT.processJSON(c, zipEntry.name.split(".").pop().toLowerCase())));
        }, error => {
          console.error(error);
          MT.toast.error('"' + MT.escape(file.name) + '" is not a readable .zip file.');
        });
      } else {
        file.text().then(text => MT.processJSON(text, extension));
      }
    });
  });

  on("AddDataTab", "click", e => {
    e.preventDefault();
    MT.launchView("files");
  });

  // Starting over (or reloading) asks first, saying what goes, with a way to
  // save it before it does
  let onExit = MT.reset;
  on("exit-button", "click", () => onExit());
  on("exit-save-first", "click", () => modal("session-save-modal").show());
  const askToExit = (exit, title, action) => {
    onExit = exit;
    byId("exitModalLabel").textContent = title;
    byId("exit-button").textContent = action;
    modal("exit-modal").show();
  };
  on("NewTab", "click", e => {
    e.preventDefault();
    askToExit(MT.reset, "Start a new session?", "Start New Session");
  });

  // Leaving the page while data is loaded asks first, as the browser does it.
  // MT.reload is for reloads that have already asked.
  let leaving = false;
  MT.reload = () => {
    leaving = true;
    window.location.reload();
  };
  window.addEventListener("beforeunload", e => {
    if (leaving || !session.data.nodes.length) return;
    e.preventDefault();
    e.returnValue = "";
  });

  all(".viewbutton").forEach(button => button.addEventListener("click", e => {
    e.preventDefault();
    MT.launchView(button.dataset.href);
  }));

  // Filtering ----------------------------------------------------------------

  // Applies the link settings to the network, then tells the views
  const hiddenClusters = () => session.data.clusters.some(cluster => !cluster.visible);
  const applyFilters = () => {
    // Links are filtered by the clusters as they were (and, below, as they
    // are): with every one shown, the second pass would find the first's links
    const filtered = hiddenClusters();
    MT.setLinkVisibility(true);
    MT.tagClusters().then(() => {
      MT.setClusterVisibility(true);
      //To catch links that should be filtered out based on cluster size:
      if (filtered || hiddenClusters()) MT.setLinkVisibility(true);
      MT.setNodeVisibility(true);
      //Because the network isn't robust to the order in which these operations
      //take place, we just do them all silently and then react as though we did
      //them each after all of them are already done.
      events.emitTogether(["cluster", "link", "node"].map(thing => thing + "-visibility"));
      MT.updateStatistics();
    });
  };
  // Changes that come close together (the arrow keys held on the threshold, a
  // setting changed twice) are applied once, with the last values, a frame later
  let updateQueued = false;
  const updateNetwork = () => {
    if (updateQueued) return;
    updateQueued = true;
    let ran = false;
    const run = () => {
      if (ran) return;
      ran = true;
      updateQueued = false;
      applyFilters();
    };
    // (A tab in the background draws no frames)
    requestAnimationFrame(run);
    setTimeout(run, 100);
  };
  MT.updateNetwork = updateNetwork;

  const showEpsilon = () => {
    byId("filtering-epsilon-copy").value = Math.pow(10, parseFloat(byId("filtering-epsilon").value)).toLocaleString();
  };
  byId("filtering-epsilon").addEventListener("input", showEpsilon);

  // Pruning that fails (a worker that throws) leaves the links as they were, and says so (#222)
  const pruningFailed = error => {
    console.error(error);
    MT.toast.error("Couldn't prune the links: " + MT.escape((error && error.message) || "" + error) + ". They are shown unpruned.", 10);
    updateNetwork();
  };
  settings.subscribe("link-prune", prune => {
    if (prune !== "none") showEpsilon();
    MT.computePruning().then(updateNetwork, pruningFailed);
  });
  settings.subscribe("filtering-epsilon", () => {
    showEpsilon();
    if (get("link-prune") !== "none") MT.computePruning().then(updateNetwork, pruningFailed);
  });
  settings.subscribe("cluster-minimum-size", () => {
    MT.setClusterVisibility(true);
    MT.setLinkVisibility(true);
    MT.setNodeVisibility(true);
    events.emitTogether(["cluster", "link", "node"].map(thing => thing + "-visibility"));
    MT.updateStatistics();
  });
  // Each link field keeps its own threshold: filtering on another brings back
  // the threshold last used with it or, for a computed distance metric (TN93,
  // SNPs…), that metric's default
  settings.subscribe("link-sort-variable", field => {
    const metric = MT.distanceMetrics[MT.fieldMetric(field)];
    const saved = (get("link-thresholds") || {})[field];
    const threshold = saved != null ? saved : metric ? metric.threshold : null;
    if (metric) byId("link-threshold").step = MT.thresholdStep(metric);
    MT.updateThresholdHistogram();
    // Pruning is by the filter variable, so its flags are recomputed first
    const pruned = get("link-prune") !== "none" ? MT.computePruning() : Promise.resolve();
    pruned.then(() => {
      if (threshold != null && threshold != get("link-threshold")) settings.set("link-threshold", threshold); // eslint-disable-line eqeqeq -- the threshold may be stored as a number or as text in a saved session
      else updateNetwork();
    }, pruningFailed);
  });
  // With sparse storage, only links within the threshold at load were kept:
  // say so beside the threshold, and when it's raised past that (#228)
  let warnedStored = null;
  const showStoredRange = warn => {
    const note = byId("link-threshold-note");
    if (!note) return;
    const field = get("link-sort-variable"), stored = (get("link-stored-thresholds") || {})[field];
    if (stored == null) {
      note.hidden = true;
      warnedStored = null;
      return;
    }
    const over = MT.storedThresholdBelow(field, get("link-threshold")) != null;
    note.hidden = false;
    note.classList.toggle("text-danger", over);
    note.textContent = over
      ? `Only links up to ${stored} were kept, so a higher threshold shows no more. Reload with a higher threshold, or Keep Links: All Pairs.`
      : `Only links up to ${stored} were kept (Keep Links: Within Link Threshold).`;
    if (over && warn && warnedStored !== stored) {
      warnedStored = stored;
      MT.toast.warning(`This threshold is above ${stored}, the one the links were computed with, so no new links appear. Reload the data with a higher threshold, or Keep Links: All Pairs.`, 10);
    } else if (!over) warnedStored = null;
  };
  settings.subscribe("link-threshold", threshold => {
    settings.set("link-thresholds", Object.assign({}, get("link-thresholds"), { [get("link-sort-variable")]: threshold }));
    MT.markThreshold(threshold);
    showStoredRange(true);
    updateNetwork();
  });
  settings.subscribe(["link-sort-variable", "link-stored-thresholds"], () => showStoredRange(false));
  // The threshold's unit follows what links are filtered on (#272)
  const showThresholdUnit = () => {
    const help = MT.metricHelp[MT.fieldMetric(get("link-sort-variable"))];
    const el = byId("link-threshold-unit");
    if (el) el.textContent = help ? "In " + help[1] + ". Same setting as Link Threshold when loading files." : "In the units of the field. Same setting as Link Threshold when loading files.";
  };
  settings.subscribe("link-sort-variable", showThresholdUnit);
  showThresholdUnit();

  // Rows of the settings that only apply with some settings
  const showRows = () => {
    const rows = (selector, show) => all(selector).forEach(row => row.hidden = !show);
    rows(".filtering-epsilon-row", get("link-prune") !== "none");
    rows("#filtering-wrapper", !(get("cluster-minimum-size") > 1));
    ["node", "link"].forEach(kind => {
      const none = get(kind + "-color-variable") === "None";
      rows(`.${kind}-color-table-row`, !none);
      rows(`.${kind}-color-value-row`, none);
    });
  };
  settings.subscribe(["link-prune", "cluster-minimum-size", "node-color-variable", "link-color-variable"], showRows, { reload: true });

  // A histogram of the links' values, marking the threshold, on which a click
  // or drag sets it. It's drawn 280 wide and stretched to fit its column.
  let thresholdScale = null;
  MT.markThreshold = value => {
    if (!thresholdScale) return;
    const [x0, x1] = thresholdScale.range();
    const x = Math.max(x0, Math.min(x1, thresholdScale(value)));
    d3.select("svg#link-threshold-sparkline line.threshold-mark").attr("x1", x).attr("x2", x);
  };
  MT.updateThresholdHistogram = () => {
    let width = 280,
      height = 48,
      svg = d3
        .select("svg#link-threshold-sparkline")
        .html(null)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "none");

    // Binned straight from the graph: there can be tens of millions of links
    let lsv = get("link-sort-variable"),
      g = session.data.graph,
      max = Number.MIN_SAFE_INTEGER,
      min = Number.MAX_SAFE_INTEGER;
    g.forEachValue(lsv, v => {
      v = parseFloat(v);
      // Saturated distances are Infinity, and have no place on the scale (#281)
      if (!isFinite(v)) return;
      if (v < min) min = v;
      if (v > max) max = v;
    });
    let ticks = 40;

    let x = d3
      .scaleLinear()
      .domain([min, max])
      .range([0, width]);

    // Same bins as d3.histogram with these thresholds
    let thresholds = x.ticks(ticks).filter(t => t > min && t < max);
    let edges = [min].concat(thresholds, [max]);
    let bins = edges.slice(1).map((x1, i) => ({ x0: edges[i], x1: x1, length: 0 }));
    g.forEachValue(lsv, v => {
      v = parseFloat(v);
      if (!(v >= min && v <= max)) return;
      bins[Math.min(d3.bisectRight(thresholds, v), bins.length - 1)].length++;
    });

    let y = d3
      .scaleLinear()
      .domain([0, d3.max(bins, d => d.length)])
      .range([height, 0]);

    let bar = svg
      .selectAll(".bar")
      .data(bins)
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr("transform", d => "translate(" + x(d.x0) + "," + y(d.length) + ")");

    bar
      .append("rect")
      .attr("x", 1)
      .attr("width", 6)
      .attr("height", d => height - y(d.length));

    svg.append("line").attr("class", "threshold-mark").attr("y1", 0).attr("y2", height);
    thresholdScale = x;
    MT.markThreshold(get("link-threshold"));

    // The value under the pointer. Dragging shows the threshold as it moves;
    // the network follows on release.
    const thresholdAt = event => parseFloat(x.invert(d3.pointer(event, svg.node())[0]).toFixed(3));
    svg.on("click", event => settings.set("link-threshold", thresholdAt(event)));
    svg.on("mousedown", event => {
      event.preventDefault();
      svg.on("mousemove", event => {
        byId("link-threshold").value = thresholdAt(event);
        MT.markThreshold(thresholdAt(event));
      });
      svg.on("mouseup mouseleave", event => {
        settings.set("link-threshold", thresholdAt(event));
        svg.on("mousemove", null).on("mouseup", null).on("mouseleave", null);
      });
    });
  };

  // Settings > Filtering > Show All Hidden (and WebMCP's reveal_all)
  MT.revealAll = () => {
    settings.set("cluster-minimum-size", 1);
    MT.setClusterVisibility();
    MT.setNodeVisibility();
    MT.setLinkVisibility();
    MT.updateStatistics();
  };
  on("RevealAllTab", "click", () => MT.revealAll());

  // The network statistics -----------------------------------------------------

  // The panel shows (when it's set to) once there's a network
  const statistics = byId("network-statistics-wrapper");
  MT.showStatistics = () => {
    const show = get("network-statistics-show") && session.data.nodes.length > 0;
    statistics.style.display = show ? "block" : "none";
    if (show) MT.updateStatistics();
  };
  settings.subscribe("network-statistics-show", MT.showStatistics, { reload: true });
  MT.floatingTable(statistics, byId("network-statistics-context"), {
    onHide: () => settings.set("network-statistics-show", false)
  });
  // Selection changes are announced (with the search's count, when a search made
  // them, so one message says both)
  let searchNote = "", announcedSelection = 0;
  events.on("node-selected", () => {
    const selected = session.data.nodes.filter(d => d.selected).length;
    byId("numberOfSelectedNodes").textContent = selected.toLocaleString();
    const parts = [searchNote];
    if (selected !== announcedSelection || searchNote) {
      parts.push(selected ? `${selected.toLocaleString()} node${selected === 1 ? "" : "s"} selected` : "No nodes selected");
    }
    announcedSelection = selected;
    searchNote = "";
    const message = parts.filter(Boolean).join(". ");
    if (message) MT.announce(message);
  });

  // An SVG copy of a table, for exports, where the table sits over origin (the
  // element the SVG is a picture of). Cell values are written as text, never as
  // markup (they can come from loaded files); a value {swatch: color} makes a
  // color swatch, its color set through the style API, which ignores anything
  // that isn't a valid color.
  MT.tabulate = (data, columns, wrapper, container, origin) => {
    const box = wrapper.getBoundingClientRect(), at = origin.getBoundingClientRect();
    let foreignObj = d3.select(container).append("svg:foreignObject")
      .attr("x", box.left - at.left)
      .attr("y", box.top - at.top)
      .attr("width", box.width)
      .attr("height", box.height);
    let body = foreignObj
      .append("xhtml:body")
      .append("table")
      .style('position', 'absolute')
      .style('top', '0')
      .style('width', '100%')
      .style('height', '100%')
      .attr('cellpadding', '1px')
      .attr("class", "table-bordered");
    let thead = body.append("thead"),
        tbody = body.append("tbody");
    thead.append("tr")
      .selectAll("th")
      .data(columns)
      .enter()
      .append("th")
      .text(column => column);
    tbody.selectAll("tr")
      .data(data)
      .enter()
      .append("tr")
      .selectAll("td")
      .data(row => columns.map(column => ({ column: column, value: row[column.split(" ")[0]] })))
      .enter()
      .append("td")
      .each(function(d) {
        const cell = d3.select(this);
        if (d.value !== null && typeof d.value === "object" && "swatch" in d.value) {
          cell.append("div")
            .style("margin-left", "5px")
            .style("width", "40px")
            .style("height", "12px")
            .style("background", String(d.value.swatch));
        } else if (d.value !== undefined && d.value !== null) {
          cell.text(String(d.value));
        }
      });
    return foreignObj;
  };

  // The color tables ----------------------------------------------------------

  // A table of the colors of each value of the node (or link) color variable,
  // in which each color, transparency and name can be changed
  function showColorTable(kind) {
    const variable = get(kind + "-color-variable");
    const table = byId(kind + "-color-table"), wrapper = byId(kind + "-color-table-wrapper");
    const widget = name => kind + "-color-table-" + name;
    if (variable === "None") {
      table.innerHTML = "";
      wrapper.style.display = "none";
      events.emit(kind + "-color-change");
      return;
    }
    const Kind = kind === "node" ? "Node" : "Link";
    const sortLink = (key, other) => {
      const a = MT.sortButton();
      a.addEventListener("click", () => {
        settings.set(widget(other + "-sort"), "");
        settings.set(widget(key + "-sort"), get(widget(key + "-sort")) === "ASC" ? "DESC" : "ASC");
        showColorTable(kind);
      });
      return a;
    };
    const overwrite = session.style.overwrite || {};
    const title = overwrite[kind + "ColorHeaderVariable"] == variable ? overwrite[kind + "ColorHeaderTitle"] : Kind + " " + MT.titleize(variable); // eslint-disable-line eqeqeq -- variable names may come from a saved session, where they may be stored as numbers
    const counts = get(widget("counts")), frequencies = get(widget("frequencies"));
    table.innerHTML = "<tr></tr>";
    const header = table.querySelector("tr");
    const nameHeader = document.createElement("th");
    nameHeader.className = "p-1";
    nameHeader.contentEditable = true;
    nameHeader.textContent = title;
    nameHeader.append(sortLink("name", "counts"));
    header.append(nameHeader);
    if (counts) {
      const countHeader = document.createElement("th");
      countHeader.textContent = "Count";
      countHeader.append(sortLink("counts", "name"));
      header.append(countHeader);
    }
    if (frequencies) header.insertAdjacentHTML("beforeend", "<th>Frequency</th>");
    header.insertAdjacentHTML("beforeend", "<th>Color</th>");
    //#295
    nameHeader.addEventListener("focusout", () => {
      session.style.overwrite[kind + "ColorHeaderVariable"] = get(kind + "-color-variable");
      session.style.overwrite[kind + "ColorHeaderTitle"] = nameHeader.firstChild.textContent;
    });

    const names = session.style[kind + "ValueNames"] = session.style[kind + "ValueNames"] || {};
    const aggregates = kind === "node" ? MT.createNodeColorMap() : MT.createLinkColorMap();
    const total = (kind === "node" ? MT.getVisibleNodes() : MT.getVisibleLinks()).length;
    const values = Object.keys(aggregates);
    const nameSort = get(widget("name-sort")), countSort = get(widget("counts-sort"));
    if (isNaN(values[0])) { // String sorting
      if (nameSort === "ASC") values.sort();
      else if (nameSort === "DESC") values.sort((a, b) => a > b ? -1 : b > a ? 1 : 0);
    } else { // Number sorting
      if (nameSort === "ASC") values.sort((a, b) => a - b);
      else if (nameSort === "DESC") values.sort((a, b) => b - a);
    }
    if (countSort === "ASC") values.sort((a, b) => aggregates[a] - aggregates[b]);
    else if (countSort === "DESC") values.sort((a, b) => aggregates[b] - aggregates[a]);

    // The maps and their saved values: nodeColorMap, nodeColorsTable and so on
    const colorMap = kind + "ColorMap", alphaMap = kind + "AlphaMap", alphas = kind + "Alphas";
    const savedColors = kind + "ColorsTable", savedKeys = kind + "ColorsTableKeys";
    // During the timeline the colors are kept separately (as linkColorsKeys, for links)
    const timelineColors = kind + "Color", timelineKeys = kind === "node" ? "nodeColorKeys" : "linkColorsKeys";

    values.forEach((value, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td data-value="${MT.escape(value)}">${MT.escape(names[value] || MT.valueLabel(value))}</td>` +
        (counts ? `<td>${aggregates[value]}</td>` : "") +
        (frequencies ? `<td>${(aggregates[value] / total).toLocaleString()}</td>` : "") +
        `<td><input type="color">${MT.transparencyButton}</td>`;
      // (Set as a property: the color comes from the session, and could be markup)
      row.querySelector("input").value = temp.style[colorMap](value);
      MT.nameRow(row, names[value] || MT.valueLabel(value));
      row.querySelector("input").addEventListener("change", e => {
        const key = session.style[savedKeys][variable].findIndex(k => k === value);
        session.style[savedColors][variable].splice(key, 1, e.target.value);
        if (get("node-timeline-variable") === "None") {
          temp.style[colorMap] = MT.colorScale(session.style[savedColors][variable], session.style[savedKeys][variable]);
        } else {
          const timelineKey = temp.style[timelineKeys].findIndex(k => k === value);
          temp.style[timelineColors].splice(timelineKey, 1, e.target.value);
          temp.style[colorMap] = MT.colorScale(temp.style[timelineColors], temp.style[timelineKeys]);
        }
        events.emit(kind + "-color-change");
      });
      // Transparency, with the shared slider
      row.querySelector("a").addEventListener("click", e => {
        const slider = byId("color-transparency"), sliderWrapper = byId("color-transparency-wrapper");
        Object.assign(sliderWrapper.style, { top: (e.clientY + 129) + "px", left: e.clientX + "px", display: "block" });
        slider.value = session.style[alphas][i];
        slider.addEventListener("change", () => {
          session.style[alphas].splice(i, 1, parseFloat(slider.value));
          temp.style[alphaMap] = MT.colorScale(session.style[alphas], values);
          sliderWrapper.style.display = "none";
          events.emit(kind + "-color-change");
        }, { once: true });
      });
      // Double-click a value (or press F2 or Enter on it) to rename it
      const name = row.querySelector("td");
      MT.renamable(name);
      name.addEventListener("focusout", () => {
        name.contentEditable = false;
        names[value] = name.textContent;
        MT.nameRow(row, name.textContent);
      });
      table.append(row);
    });

    MT.sortable(table, { items: "tr" });
    wrapper.style.display = get(widget("show")) ? "block" : "none";
    events.emit(kind + "-color-change");
  }

  MT.showColorTable = showColorTable;

  ["node", "link"].forEach(kind => {
    const wrapper = byId(kind + "-color-table-wrapper");
    const toggle = key => () => {
      settings.set(key, !get(key));
      showColorTable(kind);
    };
    MT.floatingTable(wrapper, byId(kind + "-color-table-context"), {
      onHide: () => settings.set(kind + "-color-table-show", false),
      onCounts: toggle(kind + "-color-table-counts"),
      onFrequencies: toggle(kind + "-color-table-frequencies"),
      onSelect: kind === "node" ? selectNodesOfRow : undefined
    });
    settings.subscribe(kind + "-color-variable", () => showColorTable(kind));
    settings.subscribe(kind + "-color-table-show", show => {
      wrapper.style.display = show && get(kind + "-color-variable") !== "None" ? "block" : "none";
    }, { reload: true });
  });

  // Selects the visible nodes whose color value is a row's value, in place of
  // the selection (#295): the menu's Select These Nodes, for keyboard users too.
  // The selection's announcement comes from node-selected, as for any change.
  function selectNodesOfRow(cell) {
    if (!cell) return MT.announce("Choose a value in the table first.");
    const variable = get("node-color-variable"), value = cell.dataset.value;
    session.data.nodes.forEach(d => { d.selected = !!d.visible && String(d[variable]) === value; });
    events.emit("node-selected");
  }

  // A categorical node color with more values than a few is hard to tell apart
  // by color alone, so once per variable (#294) the page suggests showing it as
  // shapes too, in a toast the user can take or leave. Only when the variable is
  // chosen, not when a session that already has it is opened.
  const shapeSuggested = new Set();
  settings.subscribe("node-color-variable", variable => {
    if (variable === "None" || shapeSuggested.has(variable) || get("node-symbol-variable") !== "None") return;
    const values = new Set(session.data.nodes.filter(d => d.visible).map(d => String(d[variable]))).size;
    // (Up to six values, or seven with (Empty), are still told apart by color)
    if (values <= 6) return;
    shapeSuggested.add(variable);
    const name = MT.escape(MT.titleize(variable));
    MT.toast.info(`${values.toLocaleString()} values of ${name} are hard to tell apart by color alone. Show ${name} as shapes too?`,
      taken => { if (taken && get("node-color-variable") === variable) settings.set("node-symbol-variable", variable); },
      { action: "Show as shapes" });
  });

  // The colors ----------------------------------------------------------------

  settings.subscribe("node-color", () => events.emit("node-color-change"));
  settings.subscribe("node-color-border", () => events.emit("node-border-change"));
  settings.subscribe("link-color", () => events.emit("link-color-change"));
  settings.subscribe("selected-color", color => {
    settings.set("selected-color-contrast", MT.contrastColor(color));
    events.emit("selected-color-change");
  });
  settings.subscribe("background-color", color => {
    settings.set("background-color-contrast", MT.contrastColor(color));
    events.emit("background-color-change");
  });

  // The global timeline -------------------------------------------------------

  // The global timeline: a slider over the dates of the timeline variable that
  // The timeline's bar sits below the views, which shrink to make room for it
  function showTimelineBar(open) {
    const bar = byId("global-timeline-wrapper");
    bar.style.display = open ? "block" : "none";
    document.body.style.setProperty("--timeline-height", open ? bar.offsetHeight + "px" : "0px");
    document.body.classList.toggle("timeline-open", open);
  }

  // shows the network as of each date. Showing it again for the same variable
  // (previous == variable, as when a session is loaded) keeps its place.
  MT.showTimeline = (variable = session.style.widgets["node-timeline-variable"], previous = variable) => {
      d3.select('#global-timeline svg').remove();
      clearInterval(session.timeline);
      MT.scrubTimeline = null;
      MT.setTimelinePlaying = null;
      const pin = document.getElementById("pinbutton");
      let loadingJsonFile = previous === variable;
      if (previous !== 'None' && !loadingJsonFile) {
        // change timeline variable when end time not reaching target time - redraw netwrok to start fresh
        if (MT.parseDate(session.state.timeEnd) < MT.parseDate(session.state.timeTarget)) {
          session.state.timeEnd = session.state.timeTarget;
          MT.setNodeVisibility(false);
          MT.setLinkVisibility(false);
          MT.updateStatistics();
        }
      }
      // Already stored when the change came from the setting itself, so this notifies
      // only when showTimeline is called directly with another variable
      settings.set("node-timeline-variable", variable);
      if (variable === "None") {
        document.getElementById("global-timeline-field").innerHTML = "";
        settings.set("timeline-date-field", 'None');
        showTimelineBar(false);
        if (pin) pin.disabled = false;
        if(pin && !session.network.timelinePinned) {
          pin.click();
          MT.updatePinNodes(false);
        }
        session.network.timelineNodes = [];
        MT.setNodeVisibility(false);
        MT.setLinkVisibility(false);
        MT.updateStatistics();
        return;
      }
      if(!temp.style.nodeColor) showColorTable("node");
      if (pin && !pin.disabled){
        if (!loadingJsonFile) {
          session.network.timelinePinned= session.network.allPinned;
          if(!session.network.allPinned) {
            MT.updatePinNodes(true);
            pin.click();
          }
          session.network.timelineNodes = MT.getNetworkNodes();
        }
        pin.disabled = true;
      }
      let globalTimelineField =  (session.style.overwrite && variable == session.style.overwrite.globalTimelineFieldVariable ? session.style.overwrite.globalTimelineField : MT.titleize(variable)); // eslint-disable-line eqeqeq -- variable names may come from a saved session, where they may be stored as numbers
      document.getElementById("global-timeline-field").textContent = globalTimelineField;
  
      var formatDateIntoYear = d3.timeFormat("%Y");
      var formatDateIntoMonthYear = d3.timeFormat("%b %y");
      var formatDateIntoMonth = d3.timeFormat("%b");
      var formatDateMonthYear = d3.timeFormat("%b %Y");
      var formatDateDateMonth = d3.timeFormat("%b %_d");

      let timeDomainStart, timeDomainEnd;
      let field = variable;
      // (From the dates read once for the steps, not from copies of the nodes)
      const dated = Array.from(MT.nodeTimes(field)).filter(time => !isNaN(time));
      if (dated.length < 2) {
        dated.length = 0;
        dated.push(+new Date(2000, 1, 1), +new Date());
      }
      timeDomainStart = dated.reduce((a, b) => Math.min(a, b));
      timeDomainEnd = dated.reduce((a, b) => Math.max(a, b));

      var days = Math.floor((timeDomainEnd - timeDomainStart) / 864e5);
      // Each year named where it starts (or on the first tick)
      var tickDateFormat = (d, i) => {
        if (days<184) return formatDateDateMonth(d);
        else if (days<367) return d.getMonth() === 0 || i === 0 ? formatDateMonthYear(d) : formatDateIntoMonth(d);
        else if (days<367*5) return formatDateIntoMonthYear(d);
        else return formatDateIntoYear(d);		
      }
      var handleDateFormat = d => {
        if (days<367) return formatDateDateMonth(d);
        else return formatDateMonthYear(d);		
      }
      let startDate = timeDomainStart;
      let endDate = timeDomainEnd;
      var margin = {top:50, right:50, bottom:0, left:50},
        network = document.querySelector(".network-view"),
        width = (((network && network.parentElement.clientWidth) || window.innerWidth) * 4 / 5) - margin.left - margin.right,
        height = 200 - margin.top - margin.bottom;
      var svgTimeline = d3.select("#global-timeline")
          .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", 120);  

          ////////// slider //////////
      var currentValue = 0;
      var targetValue = width;
      var playButton = d3.select("#timeline-play-button");
      if (playButton.text() === "Pause") playButton.text("Play");
      var x = d3.scaleTime()
          .domain([startDate, endDate])
          .range([0, targetValue])
          .clamp(true)
          .nice();
      // (Centered, as wide on each side as its title)
      var slider = svgTimeline.append("g")
          .attr("class", "slider")
          .attr("transform", "translate(" + margin.left + "," + height/2 + ")");
      slider.append("line")
          .attr("class", "track")
          .attr("x1", x.range()[0])
          .attr("x2", x.range()[1])
        .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
          .attr("class", "track-inset")
        .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
          .attr("class", "track-overlay")
          .call(d3.drag()
              .on("start.interrupt", function() { slider.interrupt(); })
              .on("start drag", function(event) {
                currentValue = event.x;
                update(x.invert(currentValue));
                if (playButton.text() === "Pause") {
                  playButton.text("Play"); 
                  clearInterval(session.timeline);
                }
              })
          );
      slider.insert("g", ".track-overlay")
        .attr("class", "ticks")
        .attr("transform", "translate(0," + 18 + ")")
        .selectAll("text")
        .data(x.ticks(12))
        .enter()
        .append("text")
        .attr("x", x)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .text(function(d, i) { return tickDateFormat(d, i); });
      var handle = slider.insert("circle", ".track-overlay")
          .attr("class", "handle")
          .attr("r", 9);
      // The handle starts at the end, as the network does, showing every node
      currentValue = targetValue;
      handle.attr("cx", targetValue);
      var label = slider.append("text")  
          .attr("class", "label")
          .attr("text-anchor", "middle")
          .attr("x", targetValue)
          .text(handleDateFormat(endDate))
          .attr("transform", "translate(0," + (-20) + ")")
      const togglePlayback = () => {
        if (playButton.text() === "Pause") {
          playButton.text("Play");
          clearInterval(session.timeline);
        } else {
          playButton.text("Pause");
          // From the start again, once it's reached the end
          if (currentValue >= targetValue) currentValue = 0;
          session.timeline = setInterval(step, 200);
        }
      };
      playButton.on("click", togglePlayback);
      // Plays or pauses the animation, as the Play button does (WebMCP's control_timeline_playback)
      MT.setTimelinePlaying = play => {
        if (play != (playButton.text() === "Pause")) togglePlayback(); // eslint-disable-line eqeqeq -- play may arrive from WebMCP as 1 or 0, which must match a boolean
      };
      function step() { 
        update(x.invert(currentValue));
        if (currentValue > targetValue) { 
          currentValue = 0;
          clearInterval(session.timeline);
          playButton.text("Play");
          return;
        }
        currentValue = currentValue + (targetValue/151);
      }
      session.state.timeStart = startDate;
      session.state.timeTarget = x.invert(targetValue);
      // After the times above, so that any redraw this causes sees them
      settings.set("timeline-date-field", field);
      if (loadingJsonFile && MT.parseDate(session.state.timeEnd) < MT.parseDate(session.state.timeTarget)) {
        let t = MT.parseDate(session.state.timeEnd);
        currentValue = x(t);
        handle.attr("cx", x(t));
        label
          .attr("x", x(t))
          .text(handleDateFormat(t));
      }
      showTimelineBar(true);
      // Moves the timeline's handle to a date (for scripts and agents)
      MT.scrubTimeline = date => {
        const h = MT.parseDate(date);
        currentValue = x(h);
        update(h);
      };
      function update(h) {
        handle.attr("cx", x(h));
        label
          .attr("x", x(h))
          .text(handleDateFormat(h));
        session.state.timeEnd = h;
        // The visible links don't depend on the date (only which of them have
        // both nodes shown), so they aren't worked out again at each step
        MT.setNodeVisibility(true);
        events.emitTogether(["node-visibility", "link-visibility"]);
        MT.updateStatistics();
      }
  };

  // The timeline variable it last showed: a new choice starts it over
  let timelineVariable = get("node-timeline-variable");
  settings.subscribe("node-timeline-variable", variable => MT.showTimeline(variable, timelineVariable));
  // (after the above, so it sees the previous value; and when a session loads)
  settings.subscribe("node-timeline-variable", variable => { timelineVariable = variable; }, { reload: true });

  on("global-timeline-field", "focusout", e => {
    session.style.overwrite.globalTimelineFieldVariable = get("node-timeline-variable");
    session.style.overwrite.globalTimelineField = e.target.textContent;
  });

  // Search ----------------------------------------------------------------

  const search = byId("search"), results = byId("search-results");
  // The box is a combobox over its suggestions (the list is never focused:
  // the active suggestion is named by aria-activedescendant)
  const options = () => Array.from(results.querySelectorAll("li"));
  const setActive = li => {
    options().forEach(o => {
      o.classList.toggle("active", o === li);
      o.setAttribute("aria-selected", o === li);
    });
    if (li) {
      search.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView({ block: "nearest" });
    } else {
      search.removeAttribute("aria-activedescendant");
    }
  };
  const hideResults = () => {
    results.innerHTML = "";
    results.style.display = "none";
    search.setAttribute("aria-expanded", "false");
    search.removeAttribute("aria-activedescendant");
  };
  const showResults = () => {
    results.style.display = "block";
    search.setAttribute("aria-expanded", "true");
  };

  //#298: match case and match whole words, then search again. The buttons
  // show whether they're on.
  [["casesensitivebutton", "search-case-sensitive"], ["wholewordbutton", "search-whole-word"]].forEach(([id, key]) => {
    const button = byId(id);
    const show = pressed => {
      button.classList.toggle("active", !!pressed);
      button.setAttribute("aria-pressed", !!pressed);
    };
    on(id, "click", () => {
      settings.set(key, !get(key));
      search.dispatchEvent(new Event("input"));
      hideResults();
    });
    settings.subscribe(key, show, { reload: true });
    show(get(key));
  });

  // The box says which field it searches
  const showField = field => { search.placeholder = "Search nodes by " + MT.titleize(field); };
  settings.subscribe("search-field", showField, { reload: true });
  showField(get("search-field"));

  // A search for value selects the nodes whose search field matches it
  const pattern = value => {
    if (get("search-whole-word")) value = "\\b" + value + "\\b";
    return get("search-case-sensitive") ? new RegExp(value) : new RegExp(value, "i");
  };
  const selectMatches = (re, value) => {
    const field = get("search-field");
    session.data.nodes.forEach(node => {
      if (!node[field]) node.selected = false;
      if (typeof node[field] === "string") node.selected = re.test(node[field]);
      if (typeof node[field] === "number") node.selected = node[field] + "" === value;
    });
  };
  // Choosing a suggestion searches for exactly it
  const choose = li => {
    const v = li.dataset.value;
    search.value = v;
    hideResults();
    selectMatches(pattern(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), v);
    events.emit("node-selected");
  };

  search.addEventListener("blur", () => setTimeout(hideResults, 300));
  // (A click on a suggestion shouldn't take focus from the box)
  results.addEventListener("mousedown", e => e.preventDefault());
  search.addEventListener("keydown", e => {
    const open = results.style.display === "block";
    const items = options().filter(li => !li.classList.contains("no-matches"));
    const at = items.findIndex(li => li.classList.contains("active"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open || !items.length) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(items[at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length]);
    } else if (e.key === "Enter") {
      if (open && at >= 0) {
        e.preventDefault();
        choose(items[at]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        hideResults();
      }
    }
  });
  search.addEventListener("input", () => {
    const nodes = session.data.nodes;
    const value = search.value;
    hideResults();
    search.classList.remove("is-invalid");
    if (value === "") {
      nodes.forEach(node => node.selected = false);
    } else {
      const field = get("search-field");
      const values = Array.from(new Set(nodes.filter(node => node[field]).map(node => `${node[field]}`))).sort();
      let re;
      try {
        re = pattern(value);
      } catch {
        return; // not yet a whole pattern
      }
      // Suggestions, each of which searches for itself
      let count = 0;
      values.filter(v => v.match(re)).forEach(v => {
        const li = document.createElement("li");
        li.textContent = v;
        li.dataset.value = v;
        li.id = "search-option-" + (count++);
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.addEventListener("click", () => choose(li));
        results.append(li);
        showResults();
      });
      selectMatches(re, value);
      // Nothing matches: the box says so, where the suggestions would be
      if (!nodes.some(node => node.selected)) {
        search.classList.add("is-invalid");
        const li = document.createElement("li");
        li.className = "no-matches";
        li.id = "search-no-matches";
        li.setAttribute("role", "option");
        li.setAttribute("aria-disabled", "true");
        li.textContent = "No matches";
        results.append(li);
        showResults();
      }
      searchNote = count ? `${count.toLocaleString()} suggestion${count === 1 ? "" : "s"}` : "No matches";
    }
    events.emit("node-selected");
  });

  settings.subscribe("search-field", () => search.dispatchEvent(new Event("input")));

  // Keyboard shortcuts: Ctrl+F to search, Ctrl+S to save (⌘ on a Mac). The
  // menus show them in their .shortcut spans.
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  document.querySelectorAll(".shortcut").forEach(hint => {
    hint.textContent = (mac ? "⌘" : "Ctrl+") + hint.dataset.key;
  });
  document.addEventListener("keydown", e => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === "f" && !search.disabled) {
      e.preventDefault();
      search.focus();
    }
    if (e.key === "s") {
      e.preventDefault();
      // Bootstrap ignores show() while the dialog is still fading out (right
      // after a save), so it opens again once it has gone
      const save = modal("session-save-modal");
      if (save._isTransitioning && !byId("session-save-modal").classList.contains("show")) {
        byId("session-save-modal").addEventListener("hidden.bs.modal", () => save.show(), { once: true });
      } else {
        save.show();
      }
    }
  });

  // Links to a section of the built-in Help (data-help="section-id") open it
  // there, offline too
  document.addEventListener("click", e => {
    const link = e.target.closest && e.target.closest("[data-help]");
    if (!link) return;
    e.preventDefault();
    const dialog = byId("help-modal");
    const open = () => {
      const target = byId(link.dataset.help);
      if (target) target.scrollIntoView({ block: "start" });
    };
    if (dialog.classList.contains("show")) return open();
    dialog.addEventListener("shown.bs.modal", open, { once: true });
    modal("help-modal").show();
  });

  // The color tables follow what's visible
  events.on("node-visibility", () => {
    if (get("node-color-variable") !== "None") showColorTable("node");
  });
  events.on("link-visibility", () => {
    if (get("link-color-variable") !== "None") showColorTable("link");
    if (["cluster", "degree"].includes(get("node-color-variable"))) showColorTable("node");
  });

  // Starting up -----------------------------------------------------------------

  fetch("package.json").then(r => r.json()).then(r => {
    MT.manifest = r;
    byId("version").textContent = r.commit ? r.version + " (" + r.commit + ")" : r.version;
  });

  MTBind(byId("global-settings-modal"), settings);
  MTBind(byId("search-form"), settings);
  showRows();
  if (navigator.onLine) MT.showOnline(document);

  if (location.hash === "#demo") {
    MT.loadDemo();
  } else {
    MT.launchView("files");
  }
});

