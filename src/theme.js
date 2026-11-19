// The interface is light or dark as the system is, and follows it when it
// changes (the views draw in their own colors). This runs in the head, before
// first paint, so the page doesn't flash the wrong theme.
(() => {
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.setAttribute('data-bs-theme', dark.matches ? 'dark' : 'light');
  apply();
  dark.addEventListener('change', apply);
})();
