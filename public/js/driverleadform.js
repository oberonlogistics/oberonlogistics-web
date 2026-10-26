'use strict';

// Recruiting forms (the /jobs/ application and the Careers inquiry) post to
// Philo intake. With the flag off, submit validates locally and sends nothing.
(function () {
  const LEADS_ENABLED = true;
  const INTAKE_URL = 'https://philo.oberonlogistics.com/api/intake/185cb5e8b9d518811e281e320036b771705d2d4c33655703';
  const TIMEOUT_MS = 20000;
  const FALLBACK = 'Email recruiting@oberonlogistics.com or call +1 (307) 222-8150.';

  document.querySelectorAll('form[data-intake-form]').forEach(function (form) {
    var status = form.querySelector('[data-intake-status]');
    var button = form.querySelector('button[type="submit"]');
    var sending = false;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;
      var invalid = firstInvalid(form);
      if (invalid) {
        show(status, problemFor(invalid) + ' Nothing was sent.');
        invalid.focus();
        return;
      }
      if (!LEADS_ENABLED) {
        show(status, 'Applications are not open on this page yet. Nothing was sent. ' + FALLBACK);
        return;
      }
      sending = true;
      button.disabled = true;
      show(status, 'Sending…');
      send(readPayload(form)).then(function (message) {
        if (message.ok) form.reset();
        show(status, message.text);
      }).finally(function () {
        sending = false;
        button.disabled = false;
      });
    });
  });

  function firstInvalid(form) {
    Array.prototype.forEach.call(form.querySelectorAll('input[required]:not([type="radio"])'), function (input) {
      input.setCustomValidity(input.value.trim() ? '' : 'Required');
    });
    // Not a bare :invalid, which also matches the fieldset around a radio group.
    return form.querySelector('input:invalid, textarea:invalid');
  }

  function problemFor(input) {
    if (input.type === 'email' && input.value.trim()) return 'Enter a valid email address.';
    if (input.type === 'number' && input.value.trim()) return 'Enter a number of years from 0 to 60.';
    var label = input.getAttribute('data-label') || input.name;
    return 'Missing answer: ' + label + (/\?$/.test(label) ? '' : '.');
  }

  // Flat on purpose: Philo maps name/email/phone to columns and files every
  // other top-level key under the lead's `fields` itself. Nesting a `fields`
  // key here would store the answers one level too deep.
  function readPayload(form) {
    var payload = {};
    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name || input.disabled) return;
      if ((input.type === 'radio' || input.type === 'checkbox') && !input.checked) return;
      payload[input.name] = input.value.trim();
    });
    return payload;
  }

  function send(payload) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(INTAKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (response.ok) {
        return { ok: true, text: 'Thank you. We received your submission and will be in touch.' };
      }
      if (response.status === 429) {
        return { ok: false, text: 'Too many submissions from your connection. Wait a minute and try again. ' + FALLBACK };
      }
      return { ok: false, text: 'Your submission was not received. Try again, or ' + lowerFirst(FALLBACK) };
    }, function () {
      return { ok: false, text: 'We could not confirm your submission went through. Try again, or ' + lowerFirst(FALLBACK) };
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function lowerFirst(text) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function show(status, message) {
    status.textContent = message;
    status.hidden = false;
    status.focus();
  }
})();
