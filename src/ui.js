// UI helpers: modals, search, tables, sortable lists, tooltips and toasts.
//
// Modals, the color options shortcut, search, tables and multi-select, sortable
// lists, editable names, tooltips, toasts, announcements, and names for
// icon-only buttons.
//
// A classic script, loaded after common.js (index.html gives the order). It adds
// to MT (self.MT, which common.js creates). It uses these MT names from the other files:
//   links-clusters.js: distanceMetrics
//   views.js: panelDock
// It also reads the session and temp globals, which src/index.js and the reset set on self.
(function(self){
  'use strict';
  const MT = self.MT;
  // A column heading for a Tabulator table, shown as text (Tabulator reads a
  // plain title as markup, and names come from the loaded files)
  MT.columnTitle = (title, definition) => ({ ...definition, title, titleFormatter: () => document.createTextNode(title) });

  MT.titleize = title => {
    let small = String(title).toLowerCase().replace(/_/g, " ");
    if (small == "null") return "(Empty)";
    if (small == "id" || small == " id") return "ID";
    for (const key in MT.distanceMetrics) {
      if (small == key.replace(/_/g, " ")) return MT.distanceMetrics[key].label;
    }
    if (small == "geo map") return "Map";
    if (small == "timeline") return "Epi Curve";
    if (small == "nn") return "Nearest Neighbor";
    return small.replace(/(?:^|\s|-)\S/g, c => c.toUpperCase());
  };

  // Fills a menu with an option per field: its value prefix + the field, its
  // text label + the field's title. They're built as elements, not markup, so
  // a field named by a loaded file (a session's, say) can't add any (#204).
  //   none: a "None" option first; selected: the value(s) to select;
  //   append: add to the options already there, rather than replace them
  MT.fillSelect = (select, fields, { prefix = "", label = "", none = false, selected, append = false } = {}) => {
    const chosen = [].concat(selected === undefined ? [] : selected).map(String);
    const doc = select.ownerDocument;
    const add = (value, text) => {
      const option = doc.createElement("option");
      option.value = value;
      option.textContent = text;
      if (chosen.includes(value)) option.defaultSelected = option.selected = true;
      select.appendChild(option);
    };
    if (!append) select.replaceChildren();
    if (none) add("None", "None");
    (fields || []).forEach(field => add(prefix + field, label + MT.titleize(field)));
    return select;
  };

  // Whether the user asked their system for less motion (#191)
  MT.reducedMotion = () => !!(self.matchMedia && self.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Closes a Bootstrap dialog by its id
  MT.hideModal = id => {
    const modal = document.getElementById(id);
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
  };

  // Opens the global settings at their Styling tab
  const TAB_SHOW_DELAY_MS = 250;
  MT.showColorOptions = () => {
    bootstrap.Tab.getOrCreateInstance(document.getElementById("style-tab")).show();
    // The modal opens once the Styling tab has been shown (the tab's transition takes a moment)
    setTimeout(() => bootstrap.Modal.getOrCreateInstance(document.getElementById("global-settings-modal")).show(), TAB_SHOW_DELAY_MS);
  };

  // Search works once there are nodes to search
  MT.enableSearch = enabled => {
    ['search', 'search-field'].forEach(id => { document.getElementById(id).disabled = !enabled; });
  };

  // Turns a <select multiple> into a searchable menu of removable choices (Tom
  // Select). To change its options, destroy() it and make a new one. Its menu
  // opens in the page body, so a panel's edge doesn't cut it off.
  // A Tabulator table, with its ARIA tree mended: Tabulator puts its scrolling
  // holder (focusable, so it can be scrolled with the keys) between the grid
  // and its rows, and marks column groups with a role and an attribute ARIA
  // doesn't have (and puts their columns' headers inside the group's)
  MT.table = (element, options) => {
    const table = new Tabulator(element, options);
    // A view can be resized (its tab brought forward, say) between mounting and
    // its table being built, or after the table is destroyed. Tabulator's
    // redraw throws then; building lays the table out anyway, so skip it.
    let ready = false;
    table.on('tableBuilt', () => { ready = true; });
    const redraw = table.redraw.bind(table);
    table.redraw = force => ready && !table.destroyed ? redraw(force) : undefined;
    const mend = () => {
      const root = table.element, holder = root.querySelector(':scope > .tabulator-tableholder');
      root.removeAttribute('aria-owns');
      if (holder) {
        // (With no rows, as when nothing is listed, it's neither a group of
        // them nor worth a stop of its own: there's nothing to scroll)
        if (holder.querySelector('.tabulator-row')) {
          holder.setAttribute('role', 'rowgroup');
          holder.setAttribute('tabindex', '0');
        } else {
          holder.setAttribute('role', 'none');
          holder.removeAttribute('tabindex');
        }
        holder.querySelectorAll(':scope > .tabulator-table').forEach(body => body.setAttribute('role', 'none'));
      }
      // A group's title heads its columns, which sit beside it in the row
      root.querySelectorAll('[role="columngroup"]').forEach(group => {
        group.setAttribute('role', 'none');
        group.removeAttribute('aria-title');
        group.removeAttribute('aria-sort');
        const title = group.querySelector(':scope > .tabulator-col-content');
        if (title) title.setAttribute('role', 'columnheader');
      });
    };
    table.on('tableBuilt', mend);
    table.on('renderComplete', mend);
    return table;
  };

  MT.multiSelect = (select, { max } = {}) => {
    const label = select.labels && select.labels[0];
    const name = select.getAttribute('aria-label') || (label ? label.textContent.trim() : select.title);
    const menu = new TomSelect(select, {
      plugins: ['remove_button'],
      maxItems: max || null,
      hideSelected: true,
      dropdownParent: 'body'
    });
    // Tom Select moves the label to its own field, leaving the original (kept
    // for forms, but still read out) without a name
    select.setAttribute('aria-label', name);
    if (!menu.control_input.hasAttribute('aria-labelledby')) menu.control_input.setAttribute('aria-label', name);
    return menu;
  };

  // A floating table (such as a view's legend) with a drag handle and a
  // context menu. The menu's items say what they do with data-action: drag
  // (show or hide the drag handle), hide, expand (or contract), and counts or
  // frequencies (call onCounts or onFrequencies), or select (call onSelect with
  // the value's cell, or null when the menu wasn't opened on a row). onHide hides
  // the table. Tables sit in their view's panel dock (MT.panelDock); dragging one
  // moves it from its place there. Returns a function that disconnects it.
  MT.floatingTable = (wrapper, menu, { onHide, onCounts, onFrequencies, onSelect } = {}) => {
    const handle = wrapper.querySelector('.draghandle');
    let opener = null, row = null;
    const closeMenu = () => { menu.style.display = 'none'; };
    const items = () => Array.from(menu.querySelectorAll('[data-action]'));
    const openMenu = (x, y, from) => {
      opener = from || null;
      Object.assign(menu.style, { display: 'block', position: 'fixed', left: x + 'px', top: y + 'px', zIndex: 1060 });
    };
    wrapper.addEventListener('contextmenu', e => {
      e.preventDefault();
      row = e.target.closest('[data-value]');
      openMenu(e.clientX, e.clientY, row);
    });
    // The same menu without a mouse (#185): an options button on the table, and
    // the menu key or Shift+F10 on anything in it. The menu takes the focus, its
    // arrows move between the items, and Escape closes it and gives the focus back.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'floater-menu-button btn btn-light btn-sm';
    button.title = 'Table options: hide, expand, rename values (or right-click the table)';
    button.setAttribute('aria-label', 'Table options');
    button.setAttribute('aria-haspopup', 'menu');
    button.innerHTML = '<span class="bi bi-three-dots" aria-hidden="true"></span>';
    wrapper.prepend(button);
    const openFrom = (target, box) => {
      row = target.closest && target.closest('[data-value]');
      openMenu(box.left, box.bottom, target);
      const first = items()[0];
      if (first) first.focus();
    };
    button.addEventListener('click', e => { e.stopPropagation(); openFrom(button, button.getBoundingClientRect()); });
    wrapper.addEventListener('keydown', e => {
      if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        openFrom(e.target, e.target.getBoundingClientRect());
      }
    });
    // (Taken before Bootstrap's own dropdown keys, which look for a toggle this
    // menu doesn't have)
    const menuKeys = e => {
      if (!menu.contains(e.target)) return;
      const list = items(), at = list.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Escape', 'Tab', ' '].includes(e.key)) e.stopPropagation();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
      } else if (e.key === ' ') {
        e.preventDefault();
        document.activeElement.click();
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        if (e.key === 'Escape') e.preventDefault();
        closeMenu();
        if (opener) opener.focus();
      }
    };
    window.addEventListener('keydown', menuKeys, true);
    const outside = e => { if (!menu.contains(e.target)) closeMenu(); };
    document.addEventListener('click', outside);
    menu.addEventListener('click', e => {
      const item = e.target.closest('[data-action]');
      if (!item) return;
      e.preventDefault();
      closeMenu();
      const action = item.dataset.action;
      if (action == 'drag') {
        handle.hidden = !handle.hidden;
        item.textContent = handle.hidden ? 'Drag' : 'Pin';
      } else if (action == 'hide') {
        if (onHide) onHide();
      } else if (action == 'rename') {
        // The value the menu was opened on, or the first
        const cell = (row && row.isConnected ? row : null) || wrapper.querySelector('[data-value]');
        if (cell) cell.dispatchEvent(new Event('mt-rename'));
        return;
      } else if (action == 'expand') {
        const expand = item.textContent === 'Expand';
        wrapper.classList.toggle('expanded', expand);
        item.textContent = expand ? 'Contract' : 'Expand';
      } else if (action == 'counts' && onCounts) {
        onCounts();
      } else if (action == 'frequencies' && onFrequencies) {
        onFrequencies();
      } else if (action == 'select' && onSelect) {
        onSelect(row && row.isConnected ? row : null);
      }
      if (action != 'hide' && opener && opener.isConnected) opener.focus();
    });
    let offset = [0, 0];
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const move = e => {
        offset = [offset[0] + e.movementX, offset[1] + e.movementY];
        wrapper.style.translate = offset[0] + 'px ' + offset[1] + 'px';
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), { once: true });
    });
    return () => {
      document.removeEventListener('click', outside);
      window.removeEventListener('keydown', menuKeys, true);
    };
  };

  // A legend value you can rename (#185): double-click it, or focus it and press
  // F2 or Enter (or choose Rename in the table's menu). Enter keeps the new
  // name and Escape puts the old one back; the caller keeps the name on focusout.
  MT.renamable = cell => {
    let before = '';
    const start = () => {
      before = cell.textContent;
      cell.contentEditable = true;
      cell.focus();
      getSelection().selectAllChildren(cell);
    };
    cell.tabIndex = 0;
    cell.title = 'Double-click to rename';
    cell.setAttribute('aria-keyshortcuts', 'F2 Enter');
    cell.addEventListener('dblclick', start);
    cell.addEventListener('mt-rename', start);
    cell.addEventListener('keydown', e => {
      const editing = cell.isContentEditable;
      if (!editing && (e.key === 'F2' || e.key === 'Enter')) {
        e.preventDefault();
        start();
      } else if (editing && (e.key === 'Enter' || e.key === 'Escape')) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') cell.textContent = before;
        cell.blur();
        cell.focus();
      }
    });
    return start;
  };

  // A color table's controls: a header's sort button, and a row's
  // transparency button (which opens the shared slider)
  MT.sortButton = () => {
    const button = document.createElement('a');
    button.setAttribute('role', 'button');
    button.className = 'icon-action table-control ms-1';
    button.title = 'Sort';
    button.contentEditable = false; // inside an editable header
    button.innerHTML = '<span class="bi bi-arrow-down-up"></span>';
    return button;
  };
  MT.transparencyButton = '<a role="button" class="icon-action table-control ms-1" title="Transparency"><span class="bi bi-droplet-half"></span></a>';
  // Names a color or shape table row's controls for the value it's for, as in
  // "G0 color" and "G0 transparency"
  MT.nameRow = (row, value) => {
    const input = row.querySelector('input[type="color"]'), button = row.querySelector('.table-control'), select = row.querySelector('select');
    if (input) input.setAttribute('aria-label', value + ' color');
    if (button) button.setAttribute('aria-label', value + ' transparency');
    if (select) select.setAttribute('aria-label', value + ' shape');
  };

  // html5sortable, without the roles it gives the list and its items: it marks
  // them as a listbox's options, which they aren't (a table's rows, a list of
  // menus), and hides from assistive technology the controls inside them.
  MT.sortable = (element, options) => {
    const result = sortable(element, options);
    if (options != 'destroy') {
      element.removeAttribute('aria-dropeffect');
      element.querySelectorAll('[role="option"][aria-grabbed]').forEach(item => {
        item.removeAttribute('role');
        item.removeAttribute('aria-grabbed');
      });
    }
    return result;
  };

  // Shows the shared tooltip at a mouse event, or hides it (html == null)
  MT.tooltip = (html, event) => {
    const tooltip = document.getElementById('tooltip');
    if (html == null) {
      tooltip.style.opacity = 0;
      tooltip.style.zIndex = -1;
      return;
    }
    tooltip.innerHTML = html;
    tooltip.style.left = (event.clientX + 8) + 'px';
    tooltip.style.top = (event.clientY + 18) + 'px';
    tooltip.style.zIndex = 1001;
    tooltip.style.opacity = 1;
  };

  // Shows the parts of a page that need the internet
  MT.showOnline = element => element.querySelectorAll(".ifOnline").forEach(el => {
    el.style.display = el.classList.contains("row") ? "flex" : "block";
  });

  (function () {

    var container;
    var nextId = 0;

    function init() {
      container = document.getElementById('mt-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'mt-toast-container';
        container.className = 'mt-toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
      }
    }

    // options.action names the button a toast with a callback shows (default
    // "Open"). A toast with a callback is an offer the user may want to take
    // after reading, so it stays until dismissed (WCAG 2.2.1); other toasts
    // time out, but not while the pointer or focus is in them (Bootstrap holds
    // the timer then).
    function show(message, type, duration, callback, options) {
      init();
      if (!duration && duration !== 0) duration = 5000;
      if (callback) duration = 0;

      var id = 'mt-toast-' + (++nextId);
      var bgClass = {
        success: 'bg-success text-white',
        danger: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        // (Dark text: white on Bootstrap's cyan fails the contrast the audit checks)
        info: 'bg-info text-dark'
      }[type] || 'bg-secondary text-white';
      var light = !/text-dark/.test(bgClass);

      var el = document.createElement('div');
      el.id = id;
      el.className = 'toast toast-custom ' + bgClass;
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-atomic', 'true');
      el.setAttribute('data-bs-delay', duration);
      // (message is markup, as it always was: callers escape what they include)
      el.innerHTML = '<div class="toast-inner">' +
        '<div class="toast-body" data-bs-dismiss="toast">' + message + '</div>' +
        '<div class="toast-actions">' +
        (callback ? '<button type="button" class="btn btn-sm ' + (light ? 'btn-light' : 'btn-dark') + ' toast-action" data-bs-dismiss="toast"></button>' : '') +
        '<button type="button" class="btn-close' + (light ? ' btn-close-white' : '') + ' toast-close" data-bs-dismiss="toast" aria-label="Dismiss notification"></button>' +
        '</div></div>';
      if (callback) el.querySelector('.toast-action').textContent = (options && options.action) || 'Open';
      container.appendChild(el);

      var bsToast = new bootstrap.Toast(el, { autohide: duration > 0 });
      var callbackFired = false, clicked = false;
      // The message and the action button dismiss the toast, and the callback
      // is told whether that is why it closed, as alertify's was; the close
      // button is a dismissal that isn't an answer
      el.addEventListener('click', function (e) { clicked = !e.target.closest('.toast-close'); });
      el.addEventListener('hidden.bs.toast', function () {
        if (callback && !callbackFired) {
          callbackFired = true;
          var shouldClose = callback(clicked);
          if (shouldClose === false) {
            bsToast.show(); // re-show if callback returned false (alertify compat)
          }
        }
      });

      bsToast.show();
    }

    // Simple alertify-compatible API: success, error, warning
    function createSimple(type) {
      return function (message, duration, callback, options) {
        // Normalize arguments like alertify does
        // alertify signatures:
        //   warning(message, callback)        → duration is the callback (no autohide)
        //   warning(message, 10, callback)    → duration is seconds, then callback
        //   warning(message, 3000)             → duration is ms, no callback
        if (typeof duration === 'function') {
          // message + callback only, no autohide
          show('' + message, type, 0, duration, callback);
        } else if (typeof duration === 'number') {
          // Could be ms (large number like 3000) or seconds (small number like 10)
          // alertify uses seconds, so treat as seconds → ms
          if (duration < 60000) {
            // Likely seconds: convert to ms
            show('' + message, type, duration * 1000, callback, options);
          } else {
            // Already in ms, no callback
            show('' + message, type, duration);
          }
        } else {
          show('' + message, type, 0, duration, callback);
        }
      };
    }

    MT.toast = show;
    MT.toast.success = createSimple('success');
    MT.toast.error = createSimple('danger');
    MT.toast.warning = createSimple('warning');
    MT.toast.info = createSimple('info');
  })();

  // Announcements: the one polite live region (#mt-status), for what changes
  // without moving focus (search results, selection). Repeats are announced
  // again, and a burst of changes is announced once, as its last.
  (function () {
    var timer;
    MT.announce = function (message) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var region = document.getElementById('mt-status');
        if (!region) return;
        region.textContent = '';
        // (Emptied first, in its own turn, so an unchanged message is a change)
        setTimeout(function () { region.textContent = message; }, 50);
      }, 400);
    };
  })();

  // Icon-only buttons (a gear, a camera) have a title and nothing else: that is
  // a name for the accessibility tree, but only on hover. Each gets an
  // aria-label from its title, its icon is hidden from assistive technology,
  // and its name shows beside it while it has keyboard focus (Escape hides it).
  // Done for whatever is in the page, and for what is added to it later.
  (function () {
    var tip;
    var hideTip = function () { if (tip) tip.hidden = true; };
    MT.nameIconButtons = function (root) {
      (root || document).querySelectorAll('button[title], a[role="button"][title], a.btn[title]').forEach(function (el) {
        if (el.dataset.mtName) return;
        var title = el.getAttribute('title').trim();
        if (!title || el.textContent.trim()) return; // has a name in its text
        if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) el.setAttribute('aria-label', title);
        el.dataset.mtName = title;
        el.querySelectorAll('.bi, .fa, .fas, .far, [class*="bi-"]').forEach(function (icon) { icon.setAttribute('aria-hidden', 'true'); });
      });
    };
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest && e.target.closest('[data-mt-name]');
      if (!el) return hideTip();
      var visible = false;
      try { visible = el.matches(':focus-visible'); } catch (error) { visible = true; }
      if (!visible) return hideTip();
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'mt-focus-tip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
      }
      tip.textContent = el.dataset.mtName;
      tip.hidden = false;
      var box = el.getBoundingClientRect();
      var below = box.bottom + 6;
      tip.style.top = (below + tip.offsetHeight > window.innerHeight ? Math.max(0, box.top - tip.offsetHeight - 6) : below) + 'px';
      tip.style.left = Math.max(0, Math.min(box.left, window.innerWidth - tip.offsetWidth - 4)) + 'px';
    });
    document.addEventListener('focusout', hideTip);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideTip(); });
    var pending = false;
    var sweep = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; MT.nameIconButtons(document); });
    };
    MT.nameIconButtons(document);
    // Only in a browser: the unit tests load this file in Node, without a DOM
    if (typeof MutationObserver === 'function' && document.body) {
      new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true });
    }
  })();

})(typeof self !== 'undefined' ? self : window);
