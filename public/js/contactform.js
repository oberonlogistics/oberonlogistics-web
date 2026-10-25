'use strict';

// The lead endpoint is gone. Do not POST this form, and do not tell the
// visitor we received it. A mailto link only opens a draft on their device.
(function () {
  var PHONE_HREF = 'tel:+13072228150';
  var PHONE_TEXT = '+1 (307) 222-8150';
  var INBOX = {
    info: 'info@oberonlogistics.com',
    recruiting: 'recruiting@oberonlogistics.com'
  };
  // Mail apps drop very long mailto URLs, so the draft is shortened to fit.
  var MAX_MAILTO_LENGTH = 1800;

  var form = document.querySelector('#form-lead');
  if (!form) return;
  // Own validation while this script is running so the in-page note shows
  // on phones, where the browser's bubble is easy to miss. With the script
  // absent, the required attributes still block an empty submit.
  form.noValidate = true;

  ['name', 'phone'].forEach(function (fieldName) {
    var input = form.elements.namedItem(fieldName);
    if (!input || !input.addEventListener) return;
    input.addEventListener('input', function () {
      input.setCustomValidity('');
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!fieldsAreValid(form)) {
      showProblem(form, validationMessage(form));
      return;
    }
    var email = inboxEmail(form);
    showHandoff(form, email, buildMailto(email, readFields(form)));
  });

  function inboxEmail(formEl) {
    var key = String(formEl.getAttribute('data-lead-inbox') || 'info').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(INBOX, key) ? INBOX[key] : INBOX.info;
  }

  function valueOf(formEl, fieldName) {
    var input = formEl.elements.namedItem(fieldName);
    if (!input || !('value' in input)) return '';
    return String(input.value);
  }

  function fieldsAreValid(formEl) {
    [
      ['name', 'Enter your name.'],
      ['phone', 'Enter your phone number.']
    ].forEach(function (pair) {
      var input = formEl.elements.namedItem(pair[0]);
      if (!input || !input.setCustomValidity) return;
      input.setCustomValidity(String(input.value || '').trim() ? '' : pair[1]);
    });
    if (formEl.checkValidity()) return true;
    var invalid = formEl.querySelector(':invalid');
    if (invalid && typeof invalid.focus === 'function') invalid.focus();
    return false;
  }

  function validationMessage(formEl) {
    if (!valueOf(formEl, 'name').trim()) return 'Enter your name. Nothing was sent.';
    if (!valueOf(formEl, 'phone').trim()) return 'Enter your phone number. Nothing was sent.';
    var email = formEl.elements.namedItem('email');
    if (email && email.checkValidity && !email.checkValidity()) {
      return 'Enter a valid email address, or leave it blank. Nothing was sent.';
    }
    return 'Check the highlighted fields. Nothing was sent.';
  }

  function readFields(formEl) {
    return {
      name: valueOf(formEl, 'name'),
      email: valueOf(formEl, 'email'),
      phone: valueOf(formEl, 'phone'),
      memo: valueOf(formEl, 'memo')
    };
  }

  function oneLine(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim();
  }

  function formatBody(fields) {
    var lines = [
      'Name: ' + oneLine(fields.name),
      'Email: ' + (oneLine(fields.email) || '(not provided)'),
      'Phone: ' + oneLine(fields.phone)
    ];
    var memo = String(fields.memo || '').replace(/\r\n/g, '\n').trim();
    if (memo) lines.push('', 'Message:', memo);
    return lines.join('\n');
  }

  function subjectFor(email) {
    if (email === INBOX.recruiting) return 'Careers inquiry - Oberon Logistics';
    return 'Website inquiry - Oberon Logistics';
  }

  // encodeURIComponent, not URLSearchParams: mailto needs %20, not +.
  function mailtoUrl(email, subject, body) {
    return 'mailto:' + email +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }

  function buildMailto(email, fields) {
    var subject = subjectFor(email);
    var exact = mailtoUrl(email, subject, formatBody(fields));
    if (exact.length <= MAX_MAILTO_LENGTH) return exact;

    var note = '\n\n[Draft shortened so the email link can open. Paste anything missing, then send the email yourself.]';
    var base = {
      name: oneLine(fields.name).slice(0, 200),
      email: oneLine(fields.email).slice(0, 200),
      phone: oneLine(fields.phone).slice(0, 80)
    };
    var memo = String(fields.memo || '').replace(/\r\n/g, '\n').trim();
    // Always try the shortened name/email/phone at least once, even with an
    // empty memo, before falling back to the generic draft.
    var keep = memo.length;
    while (true) {
      keep = Math.max(0, keep - 200);
      var shortened = memo.slice(0, keep).trim() + note;
      var url = mailtoUrl(email, subject, formatBody({
        name: base.name,
        email: base.email,
        phone: base.phone,
        memo: shortened
      }));
      if (url.length <= MAX_MAILTO_LENGTH) return url;
      if (keep === 0) break;
    }
    return mailtoUrl(
      email,
      subject,
      'Please include your name, phone, and message in this email before you send it.'
    );
  }

  function statusNode(formEl) {
    var el = formEl.querySelector('[data-lead-status]');
    if (el) return el;
    el = document.createElement('div');
    el.setAttribute('data-lead-status', '');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.tabIndex = -1;
    formEl.appendChild(el);
    return el;
  }

  function link(href, text) {
    var anchor = document.createElement('a');
    anchor.href = href;
    // text-dark is !important, so it stays readable inside #contact-us,
    // which otherwise paints every link light green and white on hover.
    anchor.className = 'text-dark text-decoration-underline';
    anchor.textContent = text;
    return anchor;
  }

  function contactParagraph(email, href) {
    var p = document.createElement('p');
    p.className = 'mb-0';
    p.append('Email ');
    p.append(link(href, email));
    p.append(' or call ');
    p.append(link(PHONE_HREF, PHONE_TEXT));
    p.append('.');
    return p;
  }

  function openStatus(formEl) {
    var status = statusNode(formEl);
    if (!status.hasAttribute('tabindex')) status.tabIndex = -1;
    status.classList.add('alert', 'alert-light', 'text-dark', 'text-start', 'mt-3', 'mb-0');
    // Not replaceChildren: it is missing in Safari < 14 and Chrome < 86.
    status.textContent = '';
    status.hidden = false;
    return status;
  }

  function showProblem(formEl, message) {
    var status = openStatus(formEl);
    var lead = document.createElement('p');
    lead.className = 'mb-2';
    lead.textContent = message;
    status.append(lead, contactParagraph(inboxEmail(formEl), 'mailto:' + inboxEmail(formEl)));
  }

  function showHandoff(formEl, email, mailto) {
    var status = openStatus(formEl);
    var lead = document.createElement('p');
    lead.className = 'mb-2';
    lead.textContent = 'Nothing was sent. This page cannot deliver the form.';

    var contact = contactParagraph(email, mailto);
    contact.className = 'mb-2';

    var draft = document.createElement('p');
    draft.className = 'mb-0';
    draft.textContent = 'The email link opens a draft in your mail app with what you typed. You still need to send that email. We have not received it.';

    status.append(lead, contact, draft);
    status.focus();
  }
})();
