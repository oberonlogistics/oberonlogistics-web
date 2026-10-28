/*
 * Light / dark / system theme. Loaded synchronously in <head> so the resolved
 * theme is on <html data-theme> before first paint (no flash, no layout shift).
 * The saved choice ("light" | "dark" | "system") lives in localStorage; a
 * missing or invalid value means "system".
 */
(function () {
  var KEY = 'theme';
  var CHOICES = ['light', 'dark', 'system'];
  var LABELS = { light: 'Light', dark: 'Dark', system: 'System' };
  var ICONS = { light: 'bi-sun', dark: 'bi-moon', system: 'bi-circle-half' };
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return CHOICES.indexOf(v) === -1 ? 'system' : v;
    } catch (e) {
      return 'system';
    }
  }

  function apply(choice) {
    var resolved = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-choice', choice);
  }

  apply(stored());

  function onChange() {
    if (root.getAttribute('data-theme-choice') === 'system') apply('system');
  }
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange);

  document.addEventListener('DOMContentLoaded', function () {
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    if (!toggles.length) return;

    function sync() {
      var choice = root.getAttribute('data-theme-choice');
      toggles.forEach(function (wrap) {
        var btn = wrap.querySelector('[data-theme-button]');
        var icon = btn.querySelector('i');
        btn.setAttribute('aria-label', 'Theme: ' + LABELS[choice] + '. Change theme');
        icon.className = 'bi ' + ICONS[choice];
        wrap.querySelectorAll('[data-theme-option]').forEach(function (opt) {
          opt.setAttribute('aria-pressed', String(opt.getAttribute('data-theme-option') === choice));
        });
      });
    }

    toggles.forEach(function (wrap) {
      wrap.querySelectorAll('[data-theme-option]').forEach(function (opt) {
        opt.addEventListener('click', function () {
          var choice = opt.getAttribute('data-theme-option');
          try {
            localStorage.setItem(KEY, choice);
          } catch (e) { /* storage blocked: applies for this page view only */ }
          apply(choice);
          sync();
        });
      });
    });
    sync();
  });
})();
