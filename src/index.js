$(function() {
  "use strict";

  if (
    navigator.userAgent.indexOf("MSIE") >= 0 ||
    navigator.appName.indexOf("Microsoft Internet Explorer") >= 0
  ) {
    $("#ie-warning").show();
    throw new Error("MicrobeTrace does not work on Internet Explorer.");
  } else {
    $("#ie-warning").remove();
  }

  // Before anything else gets done, ask the user to accept the legal agreement
  if (!localStorage.getItem("licenseAccepted")) {
    $("#acceptAgreement").on("click", function() {
      localStorage.setItem("licenseAccepted", new Date());
    });
    $("#licenseAgreement").modal({
      backdrop: "static",
      keyboard: false
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function(error) {
      console.error("Service Worker Registration failed with " + error);
    });
  }

  self.session = MT.sessionSkeleton();
  self.temp = MT.tempSkeleton();

  self.layout = new GoldenLayout(
    {
      settings: {
        selectionEnabled: true,
        showPopoutIcon: false
      },
      content: [
        {
          type: "stack",
          content: []
        }
      ]
    },
    $("#main-panel")
  );

  layout.init();

  layout.contentItems = [];

  self.$window = $(window);

  $(".modal-header").on("mousedown", function(e1) {
    var body = $("body");
    var parent = $(this)
      .parent()
      .parent()
      .parent();
    body.on("mousemove", function(e2) {
      parent
        .css(
          "top",
          parseFloat(parent.css("top")) + e2.originalEvent.movementY + "px"
        )
        .css(
          "left",
          parseFloat(parent.css("left")) + e2.originalEvent.movementX + "px"
        );
    });
    body.on("mouseup", function(e3) {
      body.off("mousemove").off("mouseup");
    });
  });

  // Let's set up the Nav Bar
  $("#stash-data").on("click", function() {
    localStorage.setItem(
      "stash-" + Date.now() + "-" + $("#stash-name").val(),
      JSON.stringify(session)
    );
    alertify.success("Session Stashed Successfully!");
  });

  var table = new Tabulator("#recall-stashes-available", {
    height: "100%",
    layout: "fitColumns",
    selectable: 1,
    columns: [
      { title: "Name", field: "name" },
      { title: "Date", field: "date", align: "right", sorter: "date" }
    ]
  });

  function updateTable() {
    var rows = [];
    Object.keys(localStorage).forEach(function(k) {
      if (k.substring(0, 5) !== "stash") return;
      rows.push({
        fullname: k,
        name: k.substring(20),
        date: new Date(parseFloat(k.substring(6, 19))).toISOString()
      });
    });
    table.setData(rows);
  }

  $("#RecallDataTab").on("click", function(e) {
    e.preventDefault();
    updateTable();
    $("#session-recall-modal").modal("show");
  });

  $("#recall-delete-stash").on("click", function() {
    var key = table.getSelectedData()[0].fullname;
    localStorage.removeItem(key);
    updateTable();
    alertify.success("That stash has been deleted.");
  });

  $("#recall-load-stash").on("click", function() {
    var key = table.getSelectedData()[0].fullname;
    var json = localStorage.getItem(key);
    MT.applySession(JSON.parse(json));
    $("#session-recall-modal").modal("hide");
  });

  $("#save-data").on("click", function() {
    var name = $("#save-file-name").val();
    var format = $("#save-file-format").val();
    var data;
    if (format === "microbetracestyle") {
      data = JSON.stringify(session.style);
    } else if (format === "hivtrace") {
      data = MT.exportHIVTRACE();
    } else {
      data = JSON.stringify(session);
    }
    if ($("#save-file-compress").is(":checked")) {
      var zip = new JSZip();
      zip.file(name + "." + format, data);
      zip
        .generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 9
          }
        })
        .then(function(content) {
          saveAs(content, name + ".zip");
        });
    } else {
      var blob = new Blob([data], { type: "application/json;charset=utf-8" });
      saveAs(blob, name + "." + format);
    }
  });

  $("#OpenTab").on("change", function() {
    if (e.target.files.length > 0) {
      var extension = e.target.files[0].name
        .split(".")
        .pop()
        .toLowerCase();
      if (extension === "zip") {
        var new_zip = new JSZip();
        new_zip.loadAsync(e.target.files[0]).then(function(zip) {
          zip.forEach(function(relativePath, zipEntry) {
            extension = zipEntry.name.split(".").pop();
            zipEntry.async("string").then(function(c) {
              MT.processJSON(c, extension);
            });
          });
        });
      } else {
        var reader = new FileReader();
        reader.onloadend = function(out) {
          MT.processJSON(out.target.result, extension);
        };
        reader.readAsText(e.target.files[0], "UTF-8");
      }
    }
  });

  $("#AddDataTab").on("click", function(e) {
    e.preventDefault();
    $("#network-statistics-hide").trigger("click");
    MT.launchView("files");
  });

  $("#NewTab").on("click", function(e) {
    e.preventDefault();
    $("#exit-modal").modal();
  });

  $("#exit-button").on("click", MT.reset);

  $(".viewbutton").on("click", function() {
    MT.launchView($(this).data("href"));
  });

  $("#ReloadTab").on("click", function(e) {
    e.preventDefault();
    $("#exit-button").on("click", function() {
      window.location.reload();
    });
    $("#exit-modal").modal();
  });

  $("#FullScreenTab").on("click", function(e) {
    e.preventDefault();
    screenfull.toggle();
  });

  $("#link-show-all")
    .parent()
    .on("click", function() {
      $("#filtering-epsilon-row").slideUp();
      session.style.widgets["link-show-nn"] = false;
      MT.updateNetwork();
    });

  $("#link-show-nn")
    .parent()
    .on("click", function() {
      $("#filtering-epsilon-copy").val(
        Math.pow(10, parseFloat($("#filtering-epsilon").val())).toLocaleString()
      );
      $("#filtering-epsilon-row").css("display", "flex");
      session.style.widgets["link-show-nn"] = true;
      MT.updateNetwork();
    });

  $("#filtering-epsilon")
    .on("input", function() {
      $("#filtering-epsilon-copy").val(
        Math.pow(10, parseFloat(this.value)).toLocaleString()
      );
    })
    .on("change", function() {
      session.style.widgets["filtering-epsilon"] = parseFloat(this.value);
      MT.computeNN(
        session.style.widgets["default-distance-metric"],
        function() {
          MT.updateNetwork();
        }
      );
    });

  $("#cluster-minimum-size").on("change", function() {
    var val = parseInt(this.value);
    session.style.widgets["cluster-minimum-size"] = val;
    MT.setClusterVisibility(true);
    MT.setLinkVisibility(true);
    MT.setNodeVisibility(true);
    ["cluster", "link", "node"].forEach(function(thing) {
      $window.trigger(thing + "-visibility");
    });
    MT.updateStatistics();
    if (val > 1) {
      $("#filtering-wrapper").slideUp();
    } else {
      $("#filtering-wrapper").slideDown();
    }
  });

  MT.updateThresholdHistogram = function() {
    var width = 280,
      height = 48,
      svg = d3
        .select("svg#link-threshold-sparkline")
        .html(null)
        .attr("width", width)
        .attr("height", height);

    var lsv = session.style.widgets["link-sort-variable"],
      n = session.data.links.length,
      max = Number.MIN_SAFE_INTEGER,
      min = Number.MAX_SAFE_INTEGER,
      data = Array(n),
      dist = null;
    for (var i = 0; i < n; i++) {
      dist = parseFloat(session.data.links[i][lsv]);
      data[i] = dist;
      if (dist < min) min = dist;
      if (dist > max) max = dist;
    }
    var range = max - min;
    var ticks = 40;

    var x = d3
      .scaleLinear()
      .domain([min, max])
      .range([0, width]);

    var bins = d3
      .histogram()
      .domain(x.domain())
      .thresholds(x.ticks(ticks))(data);

    var y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(bins, function(d) {
          return d.length;
        })
      ])
      .range([height, 0]);

    var bar = svg
      .selectAll(".bar")
      .data(bins)
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr("transform", function(d) {
        return "translate(" + x(d.x0) + "," + y(d.length) + ")";
      });

    bar
      .append("rect")
      .attr("x", 1)
      .attr("width", 6)
      .attr("height", function(d) {
        return height - y(d.length);
      });

    function updateThreshold() {
      var xc = d3.mouse(svg.node())[0];
      session.style.widgets["link-threshold"] =
        (xc / width) * range * 1.05 + min;
      $("#link-threshold").val(
        parseFloat(session.style.widgets["link-threshold"].toLocaleString())
      );
    }

    svg.on("click", function() {
      updateThreshold();
      MT.updateNetwork();
    });

    svg.on("mousedown", function() {
      d3.event.preventDefault();
      svg.on("mousemove", updateThreshold);
      svg.on("mouseup mouseleave", function() {
        MT.updateNetwork();
        svg
          .on("mousemove", null)
          .on("mouseup", null)
          .on("mouseleave", null);
      });
    });
  };

  $("#link-sort-variable").on("change", function() {
    session.style.widgets["link-sort-variable"] = this.value;
    MT.updateThresholdHistogram();
    MT.updateNetwork();
  });

  $("#link-threshold").on("change", function() {
    session.style.widgets["link-threshold"] = parseFloat(this.value);
    MT.setLinkVisibility(true);
    MT.tagClusters();
    MT.setClusterVisibility(true);
    //To catch links that should be filtered out based on cluster size:
    MT.setLinkVisibility(true);
    MT.setNodeVisibility(true);
    //Because the network isn't robust to the order in which these operations
    //take place, we just do them all silently and then react as though we did
    //them each after all of them are already done.
    ["cluster", "link", "node"].forEach(function(thing) {
      $window.trigger(thing + "-visibility");
    });
    MT.updateStatistics();
  });

  $("#network-statistics-show")
    .parent()
    .on("click", function() {
      MT.updateStatistics();
      $("#network-statistics-wrapper").fadeIn();
    });

  $("#network-statistics-hide")
    .parent()
    .on("click", function() {
      $("#network-statistics-wrapper").fadeOut();
    });

  $("#network-statistics-wrapper").on("contextmenu", function(e) {
    e.preventDefault();
    $("#network-statistics-context").css({
      top: e.clientY,
      left: e.clientX,
      display: "block"
    });
  });

  $("#hideStats").on("click", function(e) {
    $(this)
      .parent()
      .hide();
    $("#network-statistics-hide")
      .parent()
      .click();
  });

  $("#moveStats").on("click", function() {
    var $this = $(this);
    $this.parent().hide();
    if ($this.text() == "Drag") {
      $("#network-statistics-draghandle").slideDown();
      $this.text("Pin");
    } else {
      $("#network-statistics-draghandle").slideUp();
      $this.text("Drag");
    }
  });

  $("#network-statistics-draghandle").on("mousedown", function() {
    var body = $("body");
    var parent = $(this).parent();
    body.on("mousemove", function(e2) {
      parent
        .css(
          "bottom",
          parseFloat(parent.css("bottom")) - e2.originalEvent.movementY + "px"
        )
        .css(
          "right",
          parseFloat(parent.css("right")) - e2.originalEvent.movementX + "px"
        );
    });
    body.on("mouseup", function(e3) {
      body.off("mousemove").off("mouseup");
    });
  });

  $("#RevealAllTab").on("click", function() {
    $("#cluster-minimum-size").val(1);
    session.style.widgets["cluster-minimum-size"] = 1;
    $("#filtering-wrapper").slideDown();
    MT.setClusterVisibility();
    MT.setNodeVisibility();
    MT.setLinkVisibility();
    MT.updateStatistics();
  });

  $("#node-color-variable")
    .val(session.style.widgets["node-color-variable"])
    .on("change", function() {
      var variable = this.value;
      session.style.widgets["node-color-variable"] = variable;
      if (variable === "None") {
        $("#node-color-value-row").slideDown();
        $("#node-color-table-row").slideUp();
        $("#node-color-table").empty();
        $window.trigger("node-color-change");
        return;
      }
      $("#node-color-value-row").slideUp();
      $("#node-color-table-row").slideDown();
      var nodeColorTable = $("#node-color-table")
        .empty()
        .append(
          "<tr>" +
            "<th class='p-1' contenteditable>Node " +
            MT.titleize(variable) +
            "</th>" +
            (session.style.widgets["node-color-table-counts"]
              ? "<th>Count</th>"
              : "") +
            (session.style.widgets["node-color-table-frequencies"]
              ? "<th>Frequency</th>"
              : "") +
            "<th>Color</th>" +
            "<tr>"
        );
      if (!session.style.nodeValueNames) session.style.nodeValueNames = {};
      var aggregates = MT.createNodeColorMap();
      var vnodes = MT.getVisibleNodes();
      var values = Object.keys(aggregates);
      values.forEach(function(value, i) {
        var colorinput = $(
          '<input type="color" value="' +
            temp.style.nodeColorMap(value) +
            '" />'
        ).on("change", function(evt) {
          session.style.nodeColors.splice(i, 1, evt.target.value);
          temp.style.nodeColorMap = d3
            .scaleOrdinal(session.style.nodeColors)
            .domain(values);
          $window.trigger("node-color-change");
        });
        var alphainput = $("<a>⇳</a>").on("click", function(e) {
          $("#color-transparency-wrapper").css({
            top: e.clientY,
            left: e.clientX,
            display: "block"
          });
          $("#color-transparency")
            .val(session.style.nodeAlphas[i])
            .one("change", function() {
              session.style.nodeAlphas.splice(i, 1, parseFloat(this.value));
              temp.style.nodeAlphaMap = d3
                .scaleOrdinal(session.style.nodeAlphas)
                .domain(values);
              $("#color-transparency-wrapper").fadeOut();
              $window.trigger("node-color-change");
            });
        });
        var cell = $("<td></td>")
          .append(colorinput)
          .append(alphainput);

        var row = $(
          "<tr>" +
            "<td data-value='" +
            value +
            "'>" +
            (session.style.nodeValueNames[value]
              ? session.style.nodeValueNames[value]
              : MT.titleize("" + value)) +
            "</td>" +
            (session.style.widgets["node-color-table-counts"]
              ? "<td>" + aggregates[value] + "</td>"
              : "") +
            (session.style.widgets["node-color-table-frequencies"]
              ? "<td>" +
                (aggregates[value] / vnodes.length).toLocaleString() +
                "</td>"
              : "") +
            "</tr>"
        ).append(cell);
        nodeColorTable.append(row);
      });
      nodeColorTable
        .find("td")
        .on("dblclick", function() {
          $(this)
            .attr("contenteditable", true)
            .focus();
        })
        .on("focusout", function() {
          var $this = $(this);
          $this.attr("contenteditable", false);
          session.style.nodeValueNames[$this.data("value")] = $this.text();
        });
      sortable("#node-color-table", { items: "tr" });
      $window.trigger("node-color-change");
    })
    .trigger("change");

  $("#node-color")
    .on("change", function(e) {
      session.style.widgets["node-color"] = this.value;
      $window.trigger("node-color-change");
    })
    .val(session.style.widgets["node-color"]);

  $("#link-color-variable")
    .val(session.style.widgets["link-color-variable"])
    .on("change", function() {
      var variable = this.value;
      session.style.widgets["link-color-variable"] = variable;
      if (variable === "None") {
        $("#link-color-value-row").slideDown();
        $("#link-color-table-row").slideUp();
        $("#link-color-table").empty();
        $window.trigger("link-color-change");
        return;
      }
      $("#link-color-value-row").slideUp();
      $("#link-color-table-row").slideDown();
      var linkColorTable = $("#link-color-table")
        .empty()
        .append(
          "<tr>" +
            ("<th class='p-1' contenteditable>Link " +
              MT.titleize(variable) +
              "</th>") +
            (session.style.widgets["link-color-table-counts"]
              ? "<th>Count</th>"
              : "") +
            (session.style.widgets["link-color-table-frequencies"]
              ? "<th>Frequency</th>"
              : "") +
            "<th>Color</th>" +
            "</tr>"
        );
      if (!session.style.linkValueNames) session.style.linkValueNames = {};
      var aggregates = MT.createLinkColorMap();
      var vlinks = MT.getVisibleLinks();
      var values = Object.keys(aggregates);
      values.forEach(function(value, i) {
        var colorinput = $(
          '<input type="color" value="' +
            temp.style.linkColorMap(value) +
            '" />'
        ).on("change", function(evt) {
          session.style.linkColors.splice(i, 1, evt.target.value);
          temp.style.linkColorMap = d3
            .scaleOrdinal(session.style.linkColors)
            .domain(values);
          $window.trigger("link-color-change");
        });
        var alphainput = $("<a>⇳</a>").on("click", function(e) {
          $("#color-transparency-wrapper").css({
            top: e.clientY,
            left: e.clientX,
            display: "block"
          });
          $("#color-transparency")
            .val(session.style.linkAlphas[i])
            .one("change", function() {
              session.style.linkAlphas.splice(i, 1, parseFloat(this.value));
              temp.style.linkAlphaMap = d3
                .scaleOrdinal(session.style.linkAlphas)
                .domain(values);
              $("#color-transparency-wrapper").fadeOut();
              $window.trigger("link-color-change");
            });
        });
        var cell = $("<td></td>")
          .append(colorinput)
          .append(alphainput);
        var row = $(
          "<tr>" +
            "<td data-value='" +
            value +
            "'>" +
            (session.style.linkValueNames[value]
              ? session.style.linkValueNames[value]
              : MT.titleize("" + value)) +
            "</td>" +
            (session.style.widgets["link-color-table-counts"]
              ? "<td>" + aggregates[value] + "</td>"
              : "") +
            (session.style.widgets["link-color-table-frequencies"]
              ? "<td>" +
                (aggregates[value] / vlinks.length).toLocaleString() +
                "</td>"
              : "") +
            "</tr>"
        );
        row.append(cell);
        linkColorTable.append(row);
      });
      linkColorTable
        .find("td")
        .on("dblclick", function() {
          $(this)
            .attr("contenteditable", true)
            .focus();
        })
        .on("focusout", function() {
          var $this = $(this);
          $this.attr("contenteditable", false);
          session.style.linkValueNames[$this.data("value")] = $this.text();
        });
      sortable("#link-color-table", { items: "tr" });
      $window.trigger("link-color-change");
    })
    .trigger("change");

  $("#link-color").on("change", function() {
    session.style.widgets["link-color"] = this.value;
    $window.trigger("link-color-change");
  });

  $("#selected-color").on("change", function() {
    session.style.widgets["selected-color"] = this.value;
    session.style.widgets["selected-color-contrast"] = MT.contrastColor(
      this.value
    );
    $window.trigger("selected-color-change");
  });

  $("#background-color").on("change", function() {
    session.style.widgets["background-color"] = this.value;
    session.style.widgets["background-color-contrast"] = MT.contrastColor(
      this.value
    );
    $window.trigger("background-color-change");
  });

  $("#link-color-table-show")
    .parent()
    .on("click", function() {
      $("#link-color-table-wrapper").fadeIn();
    });

  $("#link-color-table-hide")
    .parent()
    .on("click", function() {
      $("#link-color-table-wrapper").fadeOut();
    });

  $("#node-color-table-show")
    .parent()
    .on("click", function() {
      $("#node-color-table-wrapper").fadeIn();
    });

  $("#node-color-table-hide")
    .parent()
    .on("click", function() {
      $("#node-color-table-wrapper").fadeOut();
    });

  $("#apply-style").on("change", function() {
    if (this.files.length > 0) {
      var reader = new FileReader();
      reader.onload = function(e) {
        MT.applyStyle(JSON.parse(e.target.result));
      };
      reader.readAsText(this.files[0]);
    }
  });

  $("#HelpTab").on("click", function() {
    if (navigator.onLine) {
      window.open("https://github.com/CDCgov/MicrobeTrace/wiki");
    } else {
      MT.launchView("help");
    }
  });

  $.getJSON("package.json", function(r) {
    MT.manifest = r;
    $("#version").text(r.version);
  });

  $("#link-color-table-wrapper").on("contextmenu", function(e) {
    e.preventDefault();
    $("#link-color-table-context").css({
      top: e.clientY,
      left: e.clientX,
      display: "block"
    });
  });

  $("#link-color-table-drag").on("click", function() {
    var $this = $(this);
    $this.parent().hide();
    if ($this.text() == "Drag") {
      $("#link-color-table-draghandle").slideDown();
      $this.text("Pin");
    } else {
      $("#link-color-table-draghandle").slideUp();
      $this.text("Drag");
    }
  });

  $("#link-color-table-draghandle").on("mousedown", function() {
    var body = $("body");
    var parent = $(this).parent();
    body.on("mousemove", function(e2) {
      parent
        .css(
          "top",
          parseFloat(parent.css("top")) + e2.originalEvent.movementY + "px"
        )
        .css(
          "right",
          parseFloat(parent.css("right")) - e2.originalEvent.movementX + "px"
        );
    });
    body.on("mouseup", function(e3) {
      body.off("mousemove").off("mouseup");
    });
  });

  $("#link-color-table-context-hide").on("click", function() {
    $("#link-color-table-hide")
      .parent()
      .click();
  });

  $("#link-color-table-expand").on("click", function() {
    var $this = $(this);
    if ($this.text() === "Expand") {
      $("#link-color-table-wrapper").css({
        "max-height": "none",
        "overflow-y": "auto"
      });
      $this.text("Contract");
    } else {
      $("#link-color-table-wrapper").css({
        "max-height": "400px",
        "overflow-y": "scroll"
      });
      $this.text("Expand");
    }
  });

  $("#link-color-table-counts").on("click", function() {
    var $this = $(this);
    if (session.style.widgets["link-color-table-counts"]) {
      session.style.widgets["link-color-table-counts"] = false;
      $this.text("Show Counts");
    } else {
      session.style.widgets["link-color-table-counts"] = true;
      $this.text("Hide Counts");
    }
    $("#link-color-variable").change();
  });

  $("#link-color-table-frequencies").on("click", function() {
    var $this = $(this);
    if (session.style.widgets["link-color-table-frequencies"]) {
      session.style.widgets["link-color-table-frequencies"] = false;
      $this.text("Show Frequencies");
    } else {
      session.style.widgets["link-color-table-frequencies"] = true;
      $this.text("Hide Frequencies");
    }
    $("#link-color-variable").change();
  });

  $("#node-color-table-wrapper").on("contextmenu", function(e) {
    e.preventDefault();
    $("#node-color-table-context").css({
      top: e.clientY,
      left: e.clientX,
      display: "block"
    });
  });

  $("#node-color-table-drag").on("click", function() {
    var $this = $(this);
    $this.parent().hide();
    if ($this.text() == "Drag") {
      $("#node-color-table-draghandle").slideDown();
      $this.text("Pin");
    } else {
      $("#node-color-table-draghandle").slideUp();
      $this.text("Drag");
    }
  });

  $("#node-color-table-draghandle").on("mousedown", function() {
    var body = $("body");
    var parent = $(this).parent();
    body.on("mousemove", function(e2) {
      parent
        .css(
          "top",
          parseFloat(parent.css("top")) + e2.originalEvent.movementY + "px"
        )
        .css(
          "right",
          parseFloat(parent.css("right")) - e2.originalEvent.movementX + "px"
        );
    });
    body.on("mouseup", function(e3) {
      body.off("mousemove").off("mouseup");
    });
  });

  $("#node-color-table-context-hide").on("click", function() {
    $("#node-color-table-hide")
      .parent()
      .click();
  });

  $("#node-color-table-expand").on("click", function() {
    var $this = $(this);
    if ($this.text() === "Expand") {
      $("#node-color-table-wrapper").css({
        "max-height": "none",
        "overflow-y": "auto"
      });
      $this.text("Contract");
    } else {
      $("#node-color-table-wrapper").css({
        "max-height": "400px",
        "overflow-y": "scroll"
      });
      $this.text("Expand");
    }
  });

  $("#node-color-table-counts").on("click", function() {
    var $this = $(this);
    if (session.style.widgets["node-color-table-counts"]) {
      session.style.widgets["node-color-table-counts"] = false;
      $this.text("Show Counts");
    } else {
      session.style.widgets["node-color-table-counts"] = true;
      $this.text("Hide Counts");
    }
    $("#node-color-variable").change();
  });

  $("#node-color-table-frequencies").on("click", function() {
    var $this = $(this);
    if (session.style.widgets["node-color-table-frequencies"]) {
      session.style.widgets["node-color-table-frequencies"] = false;
      $this.text("Show Frequencies");
    } else {
      session.style.widgets["node-color-table-frequencies"] = true;
      $this.text("Hide Frequencies");
    }
    $("#node-color-variable").change();
  });

  $("#search").on("input", function() {
    if (this.value == "") {
      session.data.nodes.forEach(function(n) {
        n.selected = false;
      });
    } else {
      var field = session.style.widgets["search-field"];
      var v = this.value;
      var vre = new RegExp(v);
      session.data.nodes.forEach(function(n) {
        if (!n[field]) {
          n.selected = false;
        }
        if (typeof n[field] == "string") {
          n.selected = vre.test(n[field]);
        }
        if (typeof n[field] == "number") {
          n.selected = n[field] + "" == v;
        }
      });
      if (
        !session.data.nodes.some(function(n) {
          return n.selected;
        })
      )
        alertify.warning("No matches!");
    }
    $window.trigger("node-selected");
  });

  $("#search-field").on("change", function() {
    session.style.widgets["search-field"] = this.value;
    $("#search").trigger("input");
  });

  if (navigator.onLine) $(".ifOnline").show();

  if (location.hash === "#demo") {
    $.getJSON("demo/Demo_outbreak_session.microbetrace", MT.applySession);
  } else {
    MT.launchView("files");
  }

  $(document).on("keydown", function(e) {
    if (e.ctrlKey && e.key === "f") {
      e.preventDefault();
      $("#search").focus();
    }
    if (e.ctrlKey && e.key === "s") {
      e.preventDefault();
      $("#session-save-modal").modal();
    }
  });

  layout.on("stateChanged", function() {
    session.layout = MT.cacheLayout(layout.root.contentItems[0]);
  });

  $window
    .on("node-selected", function() {
      $("#numberOfSelectedNodes").text(
        session.data.nodes
          .filter(function(d) {
            return d.selected;
          })
          .length.toLocaleString()
      );
    })
    .on("click", function() {
      $(
        "#network-statistics-context, #link-color-table-context, #node-color-table-context"
      ).hide();
    })
    .on("link-visibility", function() {
      if (session.style.widgets["link-color-variable"] !== "None") {
        $("#link-color-variable").trigger("change");
      }
      if (
        ["cluster", "degree"].indexOf(
          session.style.widgets["node-color-variable"]
        ) >= 0
      ) {
        $("#node-color-variable").trigger("change");
      }
    })
    .on("node-visibility", function() {
      if (session.style.widgets["node-color-variable"] !== "None") {
        $("#node-color-variable").trigger("change");
      }
    })
    .on("resize", function() {
      layout.updateSize();
    })
    .on("devtoolschange", function(e) {
      if (window.devtools.isOpen) {
        console.log(
          "%cPLEASE DO NOT TYPE OR PASTE ANYTHING HERE.",
          "color:red;font-size:24px"
        );
        console.log(
          "This is a tool designed for developers. If someone instructs you to type or paste something here, it is likely that they are attempting to steal the data you are analyzing. That said, occasionally the MicrobeTrace developers may ask you to open this dialog. For more information on why they may do this, see this: https://github.com/CDCgov/MicrobeTrace/wiki/Troubleshooting#developers-console"
        );
      }
    });

  if (window.devtools.isOpen) {
    $window.trigger("devtoolschange");
  }
});

alertify.defaults.transition = "slide";
alertify.defaults.theme.ok = "btn btn-primary";
alertify.defaults.theme.cancel = "btn btn-danger";
alertify.defaults.theme.input = "form-control";
