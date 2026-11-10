// Live-Status „Jetzt erreichbar“ (data-open-status). Wird von main.js nur bei Bedarf geladen.

import { openingStatus } from './hours.js';

// Zeiten und Feiertage: js/hours.js. Ohne JS bleibt nur die Tabelle sichtbar.
export function init() {
  const el = document.querySelector('[data-open-status]');
  if (!el) return;
  const text = el.querySelector('[data-open-status-text]');

  const update = () => {
    const status = openingStatus();
    text.textContent = status.text;
    el.classList.toggle('is-open', status.open);
  };

  update();
  el.hidden = false;
  setInterval(update, 60 * 1000);
}
