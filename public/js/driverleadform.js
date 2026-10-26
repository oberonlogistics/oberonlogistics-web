'use strict';

// Driver lead form for postings under /jobs/<slug>/. Until go-live (a later pass), the flag stays
// off: submit validates locally and sends nothing anywhere.
(function () {
  const LEADS_ENABLED = false;

  var form = document.querySelector('#form-driver-lead');
  if (!form) return;
  var status = form.querySelector('[data-driver-status]');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (honeypotFilled(form)) return;
    ['name', 'phone'].forEach(function (fieldName) {
      var input = form.elements.namedItem(fieldName);
      input.setCustomValidity(input.value.trim() ? '' : 'Required');
    });
    var invalid = form.querySelector(':invalid');
    if (invalid) {
      show(problemFor(invalid) + ' Nothing was sent.');
      invalid.focus();
      return;
    }
    if (!LEADS_ENABLED) {
      show('Applications are not open on this page yet. Nothing was sent. Email recruiting@oberonlogistics.com or call +1 (307) 222-8150.');
    }
  });

  function honeypotFilled(formEl) {
    var trap = formEl.elements.namedItem('website');
    return !!(trap && String(trap.value).trim());
  }

  function problemFor(input) {
    if (input.name === 'email') return 'Enter a valid email address, or leave it blank.';
    if (input.name === 'phone') return 'Enter your phone number.';
    return 'Enter your name.';
  }

  function show(message) {
    status.textContent = message;
    status.hidden = false;
    status.focus();
  }
})();
