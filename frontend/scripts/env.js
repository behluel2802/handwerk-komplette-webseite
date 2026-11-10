// Build-Optionen aus Umgebungsvariablen: Basispfad, Demo-Schalter und Betreiberdaten der öffentlichen Demo.
//
//   BASE=/unterordner/      Basispfad, unter dem die Seite liegt (Standard /), z. B. für GitHub Pages
//   Modus „demo“            vite build --mode demo (npm run build:demo) oder DEMO=1
//
// Betreiberdaten (nur Demo, Pflicht): stehen NIE im Repo. Lokal in frontend/.env.demo.local (per .gitignore
// ausgeschlossen, Vite liest sie im Modus „demo“ selbst), in GitHub Actions als Repository-Variablen.
// Fehlt ein Pflichtwert, bricht der Demo-Build ab – eine Demo ohne gültiges Impressum wird nie gebaut.

// Bundesland-Kürzel → Datenschutz-Aufsichtsbehörde für nicht-öffentliche Stellen (Art. 77 DSGVO)
export const AUTHORITIES = {
  BW: [
    'Landesbeauftragter für den Datenschutz und die Informationsfreiheit Baden-Württemberg',
    'https://www.baden-wuerttemberg.datenschutz.de',
  ],
  BY: ['Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)', 'https://www.lda.bayern.de'],
  BE: ['Berliner Beauftragte für Datenschutz und Informationsfreiheit', 'https://www.datenschutz-berlin.de'],
  BB: [
    'Landesbeauftragte für den Datenschutz und für das Recht auf Akteneinsicht Brandenburg',
    'https://www.lda.brandenburg.de',
  ],
  HB: [
    'Landesbeauftragte für Datenschutz und Informationsfreiheit der Freien Hansestadt Bremen',
    'https://www.datenschutz.bremen.de',
  ],
  HH: ['Hamburgische Beauftragte für Datenschutz und Informationsfreiheit', 'https://datenschutz-hamburg.de'],
  HE: ['Hessischer Beauftragter für Datenschutz und Informationsfreiheit', 'https://datenschutz.hessen.de'],
  MV: [
    'Landesbeauftragter für Datenschutz und Informationsfreiheit Mecklenburg-Vorpommern',
    'https://www.datenschutz-mv.de',
  ],
  NI: ['Landesbeauftragte für den Datenschutz Niedersachsen', 'https://www.lfd.niedersachsen.de'],
  NW: ['Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen', 'https://www.ldi.nrw.de'],
  RP: [
    'Landesbeauftragter für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz',
    'https://www.datenschutz.rlp.de',
  ],
  SL: ['Unabhängiges Datenschutzzentrum Saarland', 'https://www.datenschutz.saarland.de'],
  SN: ['Sächsische Datenschutz- und Transparenzbeauftragte', 'https://www.datenschutz.sachsen.de'],
  ST: ['Landesbeauftragter für den Datenschutz Sachsen-Anhalt', 'https://datenschutz.sachsen-anhalt.de'],
  SH: ['Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein', 'https://www.datenschutzzentrum.de'],
  TH: ['Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit', 'https://www.tlfdi.de'],
};

// Variable → Feld. Telefon ist Pflicht: § 5 Abs. 1 Nr. 2 DDG verlangt neben der E-Mail einen zweiten
// schnellen, unmittelbaren Kontaktweg (EuGH C-298/07). Das Demo-Formular sendet nichts, fällt also aus.
const OPERATOR_FIELDS = {
  OPERATOR_NAME: 'name',
  OPERATOR_STREET: 'street',
  OPERATOR_ZIP: 'zip',
  OPERATOR_CITY: 'city',
  OPERATOR_EMAIL: 'email',
  OPERATOR_PHONE: 'phone',
  OPERATOR_STATE: 'state',
};

/**
 * @typedef {object} Operator
 * @property {string} name
 * @property {string} street
 * @property {string} zip
 * @property {string} city
 * @property {string} email
 * @property {string} phone  Anzeige, z. B. „0170 1234567“
 * @property {string} tel    für tel:-Links, z. B. „+491701234567“
 * @property {string} state
 * @property {{ name: string, url: string }} authority
 */

/** „0170 123 45-67“ → „+491701234567“; „+43 …“ bzw. „0043 …“ bleibt international */
export function telLink(display) {
  const digits = display.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  return digits.startsWith('0') ? `+49${digits.slice(1)}` : digits;
}

/**
 * Betreiberdaten aus den Umgebungsvariablen; wirft mit Liste der fehlenden/ungültigen Werte.
 * @param {Record<string, string | undefined>} env
 * @returns {Operator}
 */
export function loadOperator(env) {
  const values = Object.fromEntries(
    Object.entries(OPERATOR_FIELDS).map(([variable, field]) => [field, (env[variable] ?? '').trim()]),
  );
  const problems = Object.entries(OPERATOR_FIELDS)
    .filter(([, field]) => !values[field])
    .map(([variable]) => `${variable} fehlt`);
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    problems.push('OPERATOR_EMAIL ist keine E-Mail-Adresse');
  if (values.zip && !/^\d{5}$/.test(values.zip)) problems.push('OPERATOR_ZIP: fünfstellige Postleitzahl erwartet');
  if (values.phone && telLink(values.phone).replace(/\D/g, '').length < 8)
    problems.push('OPERATOR_PHONE: Telefonnummer zu kurz');
  const state = values.state.toUpperCase();
  if (values.state && !AUTHORITIES[state])
    problems.push(`OPERATOR_STATE: Bundesland-Kürzel erwartet (${Object.keys(AUTHORITIES).join(', ')})`);
  if (problems.length) {
    throw new Error(
      `Demo-Build abgebrochen: Betreiberdaten für Impressum und Datenschutz unvollständig.\n  ${problems.join('\n  ')}\n` +
        '  Lokal in frontend/.env.demo.local eintragen (Vorlage: frontend/.env.demo.example), in GitHub als Repository-Variablen.',
    );
  }
  const [authorityName, authorityUrl] = AUTHORITIES[state];
  return /** @type {Operator} */ ({
    ...values,
    state,
    tel: telLink(values.phone),
    authority: { name: authorityName, url: authorityUrl },
  });
}

/**
 * @typedef {object} BuildOptions
 * @property {string} base      Basispfad mit / am Anfang und Ende
 * @property {boolean} demo
 * @property {Operator | null} operator  nur im Demo-Modus
 */

/**
 * @param {string} mode  Vite-Modus (development, production, demo)
 * @param {Record<string, string | undefined>} env  Umgebungsvariablen (inkl. .env-Dateien)
 * @returns {BuildOptions}
 */
export function buildOptions(mode, env) {
  const base = `/${(env.BASE ?? '').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
  const demo = mode === 'demo' || env.DEMO === '1';
  return { base, demo, operator: demo ? loadOperator(env) : null };
}
