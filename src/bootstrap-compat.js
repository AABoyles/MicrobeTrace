(function(){
  'use strict';

  // Two Bootstrap 4 behaviors MicrobeTrace's markup and handlers rely on, which
  // Bootstrap 5 removed or changed.

  // 1. Toggle-button groups (<div class="btn-group-toggle" data-toggle="buttons">
  // with an input inside each <label class="btn">). As Bootstrap 4 did, a click
  // on a label (after the label's own handlers) checks its input and fires
  // change, instead of the browser's label activation: handlers here click other
  // inputs while the first click is being dispatched, which can cancel a native
  // activation and leave a group with nothing checked.
  const syncGroup = input => {
    input.closest('.btn-group-toggle').querySelectorAll('.btn > input')
      .forEach(i => i.parentElement.classList.toggle('active', i.checked));
  };
  document.addEventListener('click', e => {
    const label = e.target.closest && e.target.closest('.btn-group-toggle > .btn');
    if (!label) return;
    const input = label.querySelector('input');
    if (!input || e.target === input) return;
    e.preventDefault();
    if (input.type == 'radio' && input.checked) return syncGroup(input);
    input.checked = input.type == 'radio' ? true : !input.checked;
    syncGroup(input);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Inputs clicked or changed directly (e.g. $('#id').click())
  document.addEventListener('change', e => {
    if (e.target.matches && e.target.matches('.btn-group-toggle > .btn > input')) syncGroup(e.target);
  });

  // 2. Single toggle buttons (data-toggle="button"). Bootstrap 5's version
  // (data-bs-toggle) toggles .active in the capture phase, before the button's
  // own click handlers run; Bootstrap 4 toggled after them, and handlers such as
  // the settings-pane buttons check .active expecting the state before the click.
  document.addEventListener('click', e => {
    const button = e.target.closest && e.target.closest('[data-toggle="button"]');
    if (!button || button.disabled) return;
    const active = button.classList.toggle('active');
    button.setAttribute('aria-pressed', active);
  });
})();
