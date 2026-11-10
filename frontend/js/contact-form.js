// Kontaktformular (data-contact-form). Wird von main.js nur auf Seiten mit Formular geladen.

import site from '../site.json' with { type: 'json' };
import { checks, contactKind } from './validate.js';

// Mit JS: Validierung am Feld, Versand per fetch an data-endpoint, Bestätigung statt Formular.
// Ohne JS: native Pflichtfeld-Prüfung und normales POST an die action.
// Demo-Build (__DEMO__, Briefing R6): kein Request, nach der Prüfung direkt die Demo-Bestätigung.
// Fehlt das Backend (z. B. statisches Hosting), ist das ein Fehler – nie eine Bestätigung, die nicht stimmt.

export function init() {
  const form = document.querySelector('[data-contact-form]');
  const success = document.querySelector('[data-form-success]');
  if (!form || !success) return;

  form.noValidate = true;
  const endpoint = (form.dataset.endpoint ?? '').trim();
  const status = form.querySelector('[data-form-status]');
  // Demo: Der Button ist ohne JS type="button" (sendet nie), mit JS wird er zum Absende-Button
  const submitBtn = form.querySelector('[type="submit"], [data-demo-submit]');
  submitBtn.type = 'submit';
  const el = (name) => form.elements.namedItem(name);
  const fields = { name: el('name'), kontakt: el('kontakt'), nachricht: el('nachricht') };
  let submitted = false;

  const setError = (input, message) => {
    const errorEl = document.getElementById(`${input.id}-error`);
    input.setAttribute('aria-invalid', String(Boolean(message)));
    errorEl.textContent = message;
    errorEl.hidden = !message;
  };

  // Prüfregeln: js/validate.js (identisch im Backend)
  // Prüft alle Felder, gibt die fehlerhaften in Formular-Reihenfolge zurück
  const validate = () =>
    Object.entries(fields)
      .filter(([key, input]) => {
        const message = checks[key](input.value.trim());
        setError(input, message);
        return Boolean(message);
      })
      .map(([, input]) => input);

  // Nach dem ersten Absenden live nachprüfen, damit Fehler verschwinden, sobald sie behoben sind
  Object.entries(fields).forEach(([key, input]) => {
    const recheck = () => {
      if (submitted) setError(input, checks[key](input.value.trim()));
    };
    input.addEventListener('blur', recheck);
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') recheck();
    });
  });

  const showError = (message) => {
    status.textContent = message;
    status.focus();
  };

  const showSuccess = (name) => {
    success.querySelector('[data-form-success-title]').textContent = `Vielen Dank, ${name}!`;
    form.hidden = true;
    success.hidden = false;
    success.focus();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitted = true;
    status.textContent = '';

    const invalid = validate();
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    Object.keys(data).forEach((k) => {
      data[k] = String(data[k]).trim();
    });
    data.kontaktart = contactKind(data.kontakt);
    const name = data.name;

    // Demo sendet nie; Honeypot ausgefüllt: vermutlich Bot – Erfolg vortäuschen, nichts senden
    if (__DEMO__ || data.website) {
      showSuccess(name);
      return;
    }

    form.classList.add('is-sending');
    submitBtn.disabled = true;
    let message = 'Das hat leider nicht geklappt.';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        // Backend liefert bei Fehlern { error: "…" } (z. B. Validierung, Rate-Limit)
        const result = await response.json().catch(() => ({}));
        if (result.error) message = result.error;
        throw new Error(`HTTP ${response.status}`);
      }
      showSuccess(name);
    } catch {
      showError(`${message} Bitte versuchen Sie es erneut oder rufen Sie uns an: ${site.phone.display}.`);
    } finally {
      form.classList.remove('is-sending');
      submitBtn.disabled = false;
    }
  });
}
