// MicrobeTrace's page: the menus, the global settings, the color tables and
// network statistics, the global timeline and search. The views are in
// components/; what they share is in src/common.js.
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const byId = id => document.getElementById(id);
  const all = selector => Array.from(document.querySelectorAll(selector));
  const on = (id, type, fn) => byId(id).addEventListener(type, fn);
  const modal = (id, options) => bootstrap.Modal.getOrCreateInstance(byId(id), options);
  const escape = value => String(value).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  if (navigator.userAgent.indexOf("MSIE") >= 0 || navigator.appName.indexOf("Microsoft Internet Explorer") >= 0) {
    byId("ie-warning").style.display = "block";
    throw new Error("MicrobeTrace does not work on Internet Explorer.");
  } else {
    byId("ie-warning").remove();
  }

  // Before anything else gets done, ask the user to accept the legal agreement
  localforage.getItem("licenseAccepted").then(accepted => {
    if (!accepted) {
      on("acceptAgreement", "click", () => localforage.setItem("licenseAccepted", new Date()));
      modal("licenseAgreement", { backdrop: "static", keyboard: false }).show();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(error => {
      console.error("Service Worker Registration failed with " + error);
    });
  }

  self.temp = MT.tempSkeleton();
  self.session = MT.sessionSkeleton();
  MT.createLayout();

  const settings = MT.settings, events = MT.events;
  const get = key => settings.get(key);

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

  on("stash-data", "click", () => {
    localforage.setItem("stash-" + Date.now() + "-" + byId("stash-name").value, JSON.stringify(session))
      .then(() => alertify.success("Session Stashed Successfully!"));
  });

  const stashes = new Tabulator("#recall-stashes-available", {
    height: "100%",
    layout: "fitColumns",
    selectableRows: 1,
    columns: [
      { title: "Name", field: "name" },
      // ISO dates sort correctly as strings (Tabulator's date sorter needs luxon)
      { title: "Date", field: "date", hozAlign: "right", sorter: "string" }
    ]
  });

  function updateStashes() {
    localforage.keys().then(keys => stashes.setData(keys
      .filter(k => k.substring(0, 5) === "stash")
      .map(k => ({
        fullname: k,
        name: k.substring(20),
        date: new Date(parseFloat(k.substring(6, 19))).toISOString()
      }))));
  }
  const selectedStash = () => {
    const [stash] = stashes.getSelectedData();
    return stash && stash.fullname;
  };

  on("RecallDataTab", "click", e => {
    e.preventDefault();
    updateStashes();
    modal("session-recall-modal").show();
  });

  on("recall-delete-stash", "click", () => {
    const key = selectedStash();
    if (!key) return;
    localforage.removeItem(key).then(() => {
      updateStashes();
      alertify.success("That stash has been deleted.");
    });
  });

  on("recall-load-stash", "click", () => {
    const key = selectedStash();
    if (!key) return;
    localforage.getItem(key).then(json => {
      MT.applySession(JSON.parse(json));
      modal("session-recall-modal").hide();
    });
  });

  on("save-data", "click", () => {
    const name = byId("save-file-name").value;
    const format = byId("save-file-format").value;
    let data;
    if (format == "microbetracestyle") {
      data = JSON.stringify(session.style);
    } else if (format == "hivtrace") {
      data = MT.exportHIVTRACE();
    } else {
      data = JSON.stringify(session);
    }
    if (byId("save-file-compress").checked) {
      const zip = new JSZip();
      zip.file(name + "." + format, data);
      zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } })
        .then(content => MT.saveAs(content, name + ".zip"));
    } else {
      MT.saveAs(new Blob([data], { type: "application/json;charset=utf-8" }), name + "." + format);
    }
  });

  on("OpenTab", "change", e => {
    const [file] = e.target.files;
    if (!file) return;
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension == "zip") {
      new JSZip().loadAsync(file).then(zip => {
        zip.forEach((relativePath, zipEntry) => {
          zipEntry.async("string").then(c => MT.processJSON(c, zipEntry.name.split(".").pop()));
        });
      });
    } else {
      file.text().then(text => MT.processJSON(text, extension));
    }
  });

  on("AddDataTab", "click", e => {
    e.preventDefault();
    MT.launchView("files");
  });

  // Starting over (or reloading) asks first
  let onExit = MT.reset;
  on("exit-button", "click", () => onExit());
  on("NewTab", "click", e => {
    e.preventDefault();
    onExit = MT.reset;
    modal("exit-modal").show();
  });
  on("ReloadTab", "click", e => {
    e.preventDefault();
    onExit = () => window.location.reload();
    modal("exit-modal").show();
  });

  all(".viewbutton").forEach(button => button.addEventListener("click", e => {
    e.preventDefault();
    MT.launchView(button.dataset.href);
  }));

  on("FullScreenTab", "click", e => {
    e.preventDefault();
    screenfull.toggle();
  });

  // Filtering ----------------------------------------------------------------

  // Applies the link settings to the network, then tells the views
  const updateNetwork = () => {
    MT.setLinkVisibility(true);
    MT.tagClusters().then(() => {
      MT.setClusterVisibility(true);
      //To catch links that should be filtered out based on cluster size:
      MT.setLinkVisibility(true);
      MT.setNodeVisibility(true);
      //Because the network isn't robust to the order in which these operations
      //take place, we just do them all silently and then react as though we did
      //them each after all of them are already done.
      ["cluster", "link", "node"].forEach(thing => events.emit(thing + "-visibility"));
      MT.updateStatistics();
    });
  };

  const showEpsilon = () => {
    byId("filtering-epsilon-copy").value = Math.pow(10, parseFloat(byId("filtering-epsilon").value)).toLocaleString();
  };
  byId("filtering-epsilon").addEventListener("input", showEpsilon);

  settings.subscribe("link-show-nn", nn => {
    if (nn) {
      ga('send', 'event', 'nearest-neighbor', 'trigger', 'on');
      showEpsilon();
      MT.computeMST(get("default-distance-metric")).then(updateNetwork);
    } else {
      updateNetwork();
    }
  });
  settings.subscribe("filtering-epsilon", () => {
    showEpsilon();
    MT.computeMST(get("default-distance-metric")).then(updateNetwork);
  });
  settings.subscribe("cluster-minimum-size", () => {
    MT.setClusterVisibility(true);
    MT.setLinkVisibility(true);
    MT.setNodeVisibility(true);
    ["cluster", "link", "node"].forEach(thing => events.emit(thing + "-visibility"));
    MT.updateStatistics();
  });
  settings.subscribe("link-sort-variable", () => {
    MT.updateThresholdHistogram();
    updateNetwork();
  });
  settings.subscribe("link-threshold", threshold => {
    ga('send', 'event', 'threshold', 'update', threshold);
    updateNetwork();
  });

  // Rows of the settings that only apply with some settings
  const showRows = () => {
    const rows = (selector, show) => all(selector).forEach(row => row.hidden = !show);
    rows(".filtering-epsilon-row", get("link-show-nn"));
    rows("#filtering-wrapper", !(get("cluster-minimum-size") > 1));
    ["node", "link"].forEach(kind => {
      const none = get(kind + "-color-variable") == "None";
      rows(`.${kind}-color-table-row`, !none);
      rows(`.${kind}-color-value-row`, none);
    });
  };
  settings.subscribe(["link-show-nn", "cluster-minimum-size", "node-color-variable", "link-color-variable"], showRows, { reload: true });

  // A histogram of the links' values, on which a click or drag sets the threshold
  MT.updateThresholdHistogram = () => {
    let width = 280,
      height = 48,
      svg = d3
        .select("svg#link-threshold-sparkline")
        .html(null)
        .attr("width", width)
        .attr("height", height);

    // Binned straight from the graph: there can be tens of millions of links
    let lsv = get("link-sort-variable"),
      g = session.data.graph,
      max = Number.MIN_SAFE_INTEGER,
      min = Number.MAX_SAFE_INTEGER;
    g.forEachValue(lsv, v => {
      v = parseFloat(v);
      if (v < min) min = v;
      if (v > max) max = v;
    });
    let range = max - min;
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

    // Dragging shows the threshold as it moves; the network follows on release
    const thresholdAt = event => parseFloat(((d3.pointer(event, svg.node())[0] / width) * range * 1.05 + min).toLocaleString());
    svg.on("click", event => settings.set("link-threshold", thresholdAt(event)));
    svg.on("mousedown", event => {
      event.preventDefault();
      svg.on("mousemove", event => { byId("link-threshold").value = thresholdAt(event); });
      svg.on("mouseup mouseleave", event => {
        settings.set("link-threshold", thresholdAt(event));
        svg.on("mousemove", null).on("mouseup", null).on("mouseleave", null);
      });
    });
  };

  on("RevealAllTab", "click", () => {
    settings.set("cluster-minimum-size", 1);
    MT.setClusterVisibility();
    MT.setNodeVisibility();
    MT.setLinkVisibility();
    MT.updateStatistics();
  });

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
    edge: "right",
    vertical: "bottom",
    onHide: () => settings.set("network-statistics-show", false)
  });
  events.on("node-selected", () => {
    byId("numberOfSelectedNodes").textContent = session.data.nodes.filter(d => d.selected).length.toLocaleString();
  });

  // An SVG copy of a table, for exports
  MT.tabulate = (data, columns, wrapper, container) => {
    let foreignObj = d3.select(container).append("svg:foreignObject")
      .attr("x", wrapper.offsetLeft)
      .attr("y", wrapper.offsetTop-60)
      .attr("width", wrapper.offsetWidth)
      .attr("height", wrapper.offsetHeight);
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
      .html(d => d.value);
    return foreignObj;
  };

  // The color tables ----------------------------------------------------------

  // A table of the colors of each value of the node (or link) color variable,
  // in which each color, transparency and name can be changed
  function showColorTable(kind) {
    const variable = get(kind + "-color-variable");
    const table = byId(kind + "-color-table"), wrapper = byId(kind + "-color-table-wrapper");
    const widget = name => kind + "-color-table-" + name;
    if (variable == "None") {
      table.innerHTML = "";
      wrapper.style.display = "none";
      events.emit(kind + "-color-change");
      return;
    }
    const Kind = kind == "node" ? "Node" : "Link";
    const sortLink = (key, other) => {
      const a = document.createElement("a");
      a.style.cursor = "pointer";
      a.innerHTML = "&#8645;";
      a.addEventListener("click", () => {
        session.style.widgets[widget(other + "-sort")] = "";
        session.style.widgets[widget(key + "-sort")] = get(widget(key + "-sort")) === "ASC" ? "DESC" : "ASC";
        showColorTable(kind);
      });
      return a;
    };
    const overwrite = session.style.overwrite || {};
    const title = overwrite[kind + "ColorHeaderVariable"] == variable ? overwrite[kind + "ColorHeaderTitle"] : Kind + " " + MT.titleize(variable);
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
    const aggregates = kind == "node" ? MT.createNodeColorMap() : MT.createLinkColorMap();
    const total = (kind == "node" ? MT.getVisibleNodes() : MT.getVisibleLinks()).length;
    const values = Object.keys(aggregates);
    const nameSort = get(widget("name-sort")), countSort = get(widget("counts-sort"));
    if (isNaN(values[0])) { // String sorting
      if (nameSort == "ASC") values.sort();
      else if (nameSort == "DESC") values.sort((a, b) => a > b ? -1 : b > a ? 1 : 0);
    } else { // Number sorting
      if (nameSort == "ASC") values.sort((a, b) => a - b);
      else if (nameSort == "DESC") values.sort((a, b) => b - a);
    }
    if (countSort == "ASC") values.sort((a, b) => aggregates[a] - aggregates[b]);
    else if (countSort == "DESC") values.sort((a, b) => aggregates[b] - aggregates[a]);

    // The maps and their saved values: nodeColorMap, nodeColorsTable and so on
    const colorMap = kind + "ColorMap", alphaMap = kind + "AlphaMap", alphas = kind + "Alphas";
    const savedColors = kind + "ColorsTable", savedKeys = kind + "ColorsTableKeys";
    // During the timeline the colors are kept separately (as linkColorsKeys, for links)
    const timelineColors = kind + "Color", timelineKeys = kind == "node" ? "nodeColorKeys" : "linkColorsKeys";

    values.forEach((value, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td data-value="${escape(value)}">${escape(names[value] || MT.titleize("" + value))}</td>` +
        (counts ? `<td>${aggregates[value]}</td>` : "") +
        (frequencies ? `<td>${(aggregates[value] / total).toLocaleString()}</td>` : "") +
        `<td><input type="color" value="${temp.style[colorMap](value)}"><a>⇳</a></td>`;
      row.querySelector("input").addEventListener("change", e => {
        const key = session.style[savedKeys][variable].findIndex(k => k === value);
        session.style[savedColors][variable].splice(key, 1, e.target.value);
        if (get("node-timeline-variable") == "None") {
          temp.style[colorMap] = d3.scaleOrdinal(session.style[savedColors][variable]).domain(session.style[savedKeys][variable]);
        } else {
          const timelineKey = temp.style[timelineKeys].findIndex(k => k === value);
          temp.style[timelineColors].splice(timelineKey, 1, e.target.value);
          temp.style[colorMap] = d3.scaleOrdinal(temp.style[timelineColors]).domain(temp.style[timelineKeys]);
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
          temp.style[alphaMap] = d3.scaleOrdinal(session.style[alphas]).domain(values);
          sliderWrapper.style.display = "none";
          events.emit(kind + "-color-change");
        }, { once: true });
      });
      // Double-click a value to rename it
      const name = row.querySelector("td");
      name.addEventListener("dblclick", () => {
        name.contentEditable = true;
        name.focus();
      });
      name.addEventListener("focusout", () => {
        name.contentEditable = false;
        names[value] = name.textContent;
      });
      table.append(row);
    });

    sortable(table, { items: "tr" });
    wrapper.style.display = get(widget("show")) ? "block" : "none";
    events.emit(kind + "-color-change");
  }

  ["node", "link"].forEach(kind => {
    const wrapper = byId(kind + "-color-table-wrapper");
    const toggle = key => () => {
      settings.set(key, !get(key));
      showColorTable(kind);
    };
    MT.floatingTable(wrapper, byId(kind + "-color-table-context"), {
      edge: "right",
      onHide: () => settings.set(kind + "-color-table-show", false),
      onCounts: toggle(kind + "-color-table-counts"),
      onFrequencies: toggle(kind + "-color-table-frequencies")
    });
    settings.subscribe(kind + "-color-variable", () => showColorTable(kind));
    settings.subscribe(kind + "-color-table-show", show => {
      wrapper.style.display = show && get(kind + "-color-variable") != "None" ? "block" : "none";
    }, { reload: true });
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

  // A style file applies to everything open
  on("apply-style", "change", e => {
    const [file] = e.target.files;
    if (!file) return;
    file.text().then(text => {
      MT.applyStyle(JSON.parse(text));
      showColorTable("node");
      showColorTable("link");
      ["background-color-change", "selected-color-change", "node-border-change"].forEach(type => events.emit(type));
    });
  });

  // The global timeline -------------------------------------------------------

  // The global timeline: a slider over the dates of the timeline variable that
  // shows the network as of each date. Showing it again for the same variable
  // (previous == variable, as when a session is loaded) keeps its place.
  MT.showTimeline = (variable = session.style.widgets["node-timeline-variable"], previous = variable) => {
      d3.select('#global-timeline svg').remove();
      clearInterval(session.timeline);
      const pin = document.getElementById("pinbutton");
      let loadingJsonFile = previous == variable;
      if (previous != 'None' && !loadingJsonFile) {
        // change timeline variable when end time not reaching target time - redraw netwrok to start fresh
        if (MT.parseDate(session.state.timeEnd) < MT.parseDate(session.state.timeTarget)) {
          session.state.timeEnd = session.state.timeTarget;
          MT.setNodeVisibility(false);
          MT.setLinkVisibility(false);
          MT.updateStatistics();
        }
      }
      session.style.widgets["node-timeline-variable"] = variable;
      if (variable == "None") {
        document.getElementById("global-timeline-field").innerHTML = "";
        session.style.widgets["timeline-date-field"] = 'None'  
        document.getElementById("global-timeline-wrapper").style.display = "none";
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
      let globalTimelineField =  (session.style.overwrite && variable == session.style.overwrite.globalTimelineFieldVariable ? session.style.overwrite.globalTimelineField : MT.titleize(variable));
      document.getElementById("global-timeline-field").textContent = globalTimelineField;
  
      var formatDateIntoYear = d3.timeFormat("%Y");
      var formatDateIntoMonthYear = d3.timeFormat("%b %y");
      var formatDateIntoMonth = d3.timeFormat("%b");
      var formatDateMonthYear = d3.timeFormat("%b %Y");
      var formatDateDateMonth = d3.timeFormat("%b %_d");

      let timeDomainStart, timeDomainEnd;
      let field = variable;
      let times = [],
      vnodes = JSON.parse(JSON.stringify(session.data.nodes));
      vnodes.forEach(d => {
        let time = MT.parseDate(d[field]);
        if (time) {
          d[field] = time;
          times.push(d[field]);
        } else {
          d[field] = null;
        }
      });
      if (times.length < 2) {
        times = [new Date(2000, 1, 1), new Date()];
      }
      timeDomainStart = Math.min(...times);
      timeDomainEnd = Math.max(...times);

      var days = Math.floor((timeDomainEnd - timeDomainStart) / 864e5);
      var tickDateFormat = d => {
        if (days<184) return formatDateDateMonth(d);
        else if (days<367) return formatDateIntoMonth(d);
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
      if (playButton.text() == "Pause") playButton.text("Play");
      var x = d3.scaleTime()
          .domain([startDate, endDate])
          .range([0, targetValue])
          .clamp(true)
          .nice();
      var slider = svgTimeline.append("g")
          .attr("class", "slider")
          .attr("transform", "translate(30," + height/2 + ")");
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
                if (playButton.text() == "Pause") {
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
        .text(function(d) { return tickDateFormat(d); });
      var handle = slider.insert("circle", ".track-overlay")
          .attr("class", "handle")
          .attr("r", 9);
      var label = slider.append("text")  
          .attr("class", "label")
          .attr("text-anchor", "middle")
          .text(handleDateFormat(startDate))
          .attr("transform", "translate(25," + (-20) + ")")
      playButton
        .on("click", function() {
          var button = d3.select(this);  
          if (button.text() == "Pause") {
            button.text("Play"); 
            clearInterval(session.timeline);
          } else {
            button.text("Pause");
            session.timeline = setInterval(step, 200);
          }
        })
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
      session.style.widgets["timeline-date-field"] = field;
      session.state.timeStart = startDate;
      session.state.timeTarget = x.invert(targetValue);
      if (loadingJsonFile && MT.parseDate(session.state.timeEnd) < MT.parseDate(session.state.timeTarget)) {
        let t = MT.parseDate(session.state.timeEnd);
        currentValue = x(t);
        handle.attr("cx", x(t));
        label
          .attr("x", x(t))
          .text(handleDateFormat(t));
      }
      document.getElementById("global-timeline-wrapper").style.display = "block";
      function update(h) {
        handle.attr("cx", x(h));
        label
          .attr("x", x(h))
          .text(handleDateFormat(h));
        session.state.timeEnd = h;
        MT.setNodeVisibility(false);
        MT.setLinkVisibility(false);
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
  const hideResults = () => {
    results.innerHTML = "";
    results.style.display = "none";
  };

  //#298: match case and match whole words, then search again
  [["casesensitivebutton", "search-case-sensitive"], ["wholewordbutton", "search-whole-word"]].forEach(([id, key]) => {
    on(id, "click", () => {
      session.style.widgets[key] = !session.style.widgets[key];
      search.dispatchEvent(new Event("input"));
      hideResults();
    });
  });

  // A search for value selects the nodes whose search field matches it
  const pattern = value => {
    if (get("search-whole-word")) value = "\\b" + value + "\\b";
    return get("search-case-sensitive") ? new RegExp(value) : new RegExp(value, "i");
  };
  const selectMatches = (re, value) => {
    const field = get("search-field");
    session.data.nodes.forEach(node => {
      if (!node[field]) node.selected = false;
      if (typeof node[field] == "string") node.selected = re.test(node[field]);
      if (typeof node[field] == "number") node.selected = node[field] + "" == value;
    });
  };

  search.addEventListener("blur", () => setTimeout(hideResults, 300));
  search.addEventListener("input", () => {
    const nodes = session.data.nodes;
    const value = search.value;
    hideResults();
    if (value == "") {
      nodes.forEach(node => node.selected = false);
    } else {
      const field = get("search-field");
      const values = Array.from(new Set(nodes.filter(node => node[field]).map(node => `${node[field]}`))).sort();
      let re;
      try {
        re = pattern(value);
      } catch (error) {
        return; // not yet a whole pattern
      }
      // Suggestions, each of which searches for itself
      values.filter(v => v.match(re)).forEach(v => {
        const li = document.createElement("li");
        li.textContent = v;
        li.dataset.value = v;
        li.addEventListener("click", () => {
          search.value = v;
          hideResults();
          selectMatches(pattern(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), v);
          events.emit("node-selected");
        });
        results.append(li);
        results.style.display = "block";
      });
      selectMatches(re, value);
      if (!nodes.some(node => node.selected)) alertify.warning("No matches!");
    }
    events.emit("node-selected");
  });

  settings.subscribe("search-field", () => search.dispatchEvent(new Event("input")));

  // Keyboard shortcuts: Ctrl+F to search, Ctrl+S to save
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key == "f") {
      e.preventDefault();
      search.focus();
    }
    if (e.ctrlKey && e.key == "s") {
      e.preventDefault();
      modal("session-save-modal").show();
    }
  });

  // The color tables follow what's visible
  events.on("node-visibility", () => {
    if (get("node-color-variable") !== "None") showColorTable("node");
  });
  events.on("link-visibility", () => {
    if (get("link-color-variable") !== "None") showColorTable("link");
    if (["cluster", "degree"].includes(get("node-color-variable"))) showColorTable("node");
  });

  const warnDevelopers = () => {
    if (!window.devtools.isOpen) return;
    console.log("%cPLEASE DO NOT TYPE OR PASTE ANYTHING HERE.", "color:red;font-size:24px");
    console.log(
      "This is a tool designed for developers. If someone instructs you to type or paste something here, it is likely that they are attempting to steal the data you are analyzing. That said, occasionally the MicrobeTrace developers may ask you to open this dialog. For more information on why they may do this, see this: https://github.com/CDCgov/MicrobeTrace/wiki/Troubleshooting#developers-console"
    );
  };
  window.addEventListener("devtoolschange", warnDevelopers);
  warnDevelopers();

  // Starting up -----------------------------------------------------------------

  fetch("package.json").then(r => r.json()).then(r => {
    MT.manifest = r;
    byId("version").textContent = r.version;
  });

  MTBind(byId("global-settings-modal"), settings);
  MTBind(byId("search-form"), settings);
  showRows();
  if (navigator.onLine) MT.showOnline(document);

  if (location.hash == "#demo") {
    fetch("demo/Demo_outbreak_session.microbetrace").then(r => r.json()).then(MT.applySession);
  } else {
    MT.launchView("files");
  }
});

alertify.defaults.transition = "slide";
alertify.defaults.theme.ok = "btn btn-primary";
alertify.defaults.theme.cancel = "btn btn-danger";
alertify.defaults.theme.input = "form-control";
