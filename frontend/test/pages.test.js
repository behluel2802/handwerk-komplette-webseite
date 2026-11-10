// Tests für Seitengenerator, Content-Schema, Build-Optionen und den Demo-Schalter (rechtssichere öffentliche Demo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { COLLECTIONS, loadCollections } from '../scripts/content.js';
import { loadCredits } from '../scripts/credits.js';
import { buildOptions, loadOperator, telLink } from '../scripts/env.js';
import { createRenderer, listRoutes } from '../scripts/pages.js';
import { array, object, optional, string } from '../scripts/schema.js';

const OPERATOR_ENV = {
  OPERATOR_NAME: 'Erika Test',
  OPERATOR_STREET: 'Teststraße 1',
  OPERATOR_ZIP: '10115',
  OPERATOR_CITY: 'Berlin',
  OPERATOR_EMAIL: 'erika@test.example',
  OPERATOR_PHONE: '030 1234567',
  OPERATOR_STATE: 'be',
};
const quiet = { warn: () => {} };
// Bilder werden von „npm run images“ erzeugt; ohne sie lässt sich nichts rendern
const hasImages = existsSync(new URL('../img/manifest.json', import.meta.url));

test('Routen: Ordner-URLs aus pages/, Einträge aus content/, 404 als Datei', () => {
  const routes = listRoutes();
  const urls = routes.map((r) => r.url);
  for (const url of ['/', '/impressum/', '/datenschutz/', '/danke/', '/anfrage-fehler/', '/404.html']) {
    assert.ok(urls.includes(url), url);
  }
  for (const entry of loadCollections().leistungen) {
    const route = routes.find((r) => r.url === `/leistungen/${entry.slug}/`);
    assert.equal(route?.output, `leistungen/${entry.slug}/index.html`);
  }
  assert.ok(routes.every((r) => r.url === '/404.html' || r.url.endsWith('/')));
});

test('Schema: Pflichtfelder, unbekannte Felder, Längen, verschachtelte Pfade', () => {
  const schema = object({ title: string({ max: 5 }), faq: optional(array(object({ frage: string() }))) });
  assert.deepEqual(schema({ title: 'Kurz' }, ''), []);
  assert.deepEqual(schema({}, ''), ['title: Pflichtfeld fehlt']);
  assert.match(schema({ title: 'Viel zu lang' }, '').join(), /title: höchstens 5 Zeichen/);
  assert.match(schema({ title: 'a', titel: 'b' }, '').join(), /titel: unbekanntes Feld/);
  assert.match(schema({ title: 'a', faq: [{ frage: 1 }] }, '').join(), /faq\[0\]\.frage: Text erwartet/);
});

test('Content-Schema Leistungen: ungültiges Icon und Anliegen fallen auf', () => {
  const [entry] = loadCollections().leistungen;
  const { slug: _s, url: _u, html: _h, file: _f, ...data } = entry;
  assert.deepEqual(COLLECTIONS.leistungen.schema(data, ''), []);
  const errors = COLLECTIONS.leistungen.schema({ ...data, icon: 'gibts-nicht', anliegen: 'Garten' }, '').join('\n');
  assert.match(errors, /icon: einer von/);
  assert.match(errors, /anliegen: einer von/);
});

test('Build-Optionen: Basispfad normalisiert, Demo nur mit vollständigen Betreiberdaten', () => {
  assert.equal(buildOptions('production', {}).base, '/');
  assert.equal(buildOptions('production', { BASE: 'repo' }).base, '/repo/');
  assert.equal(buildOptions('production', { BASE: '/repo/' }).base, '/repo/');
  assert.equal(buildOptions('production', {}).demo, false);
  assert.equal(buildOptions('production', {}).operator, null);

  assert.throws(() => buildOptions('demo', {}), /OPERATOR_NAME fehlt[\s\S]*OPERATOR_PHONE fehlt/);
  assert.throws(() => loadOperator({ ...OPERATOR_ENV, OPERATOR_STATE: 'XX' }), /OPERATOR_STATE/);
  assert.throws(() => loadOperator({ ...OPERATOR_ENV, OPERATOR_EMAIL: 'kein-at' }), /OPERATOR_EMAIL/);

  const { operator, demo } = buildOptions('production', { ...OPERATOR_ENV, DEMO: '1' });
  assert.equal(demo, true);
  assert.equal(operator.tel, '+49301234567');
  assert.equal(operator.state, 'BE');
  assert.match(operator.authority.name, /Berlin/);
  assert.equal(telLink('+43 1 234'), '+431234');
  assert.equal(telLink('0043 1 234'), '+431234');
});

test('Bildnachweise aus CREDITS.md: je Foto Motiv, Fotograf und Quelle', () => {
  const credits = loadCredits();
  assert.ok(credits.length >= 8);
  for (const c of credits) {
    assert.ok(c.motif && c.author);
    assert.match(c.authorUrl, /^https:\/\/unsplash\.com\//);
    assert.match(c.sourceUrl, /^https:\/\/unsplash\.com\/photos\//);
  }
});

test('Normaler Build: Anruf-Links wählen, Formular sendet ans Backend, keine Demo-Leiste', { skip: !hasImages }, () => {
  const renderer = createRenderer({ ...buildOptions('production', {}), ...quiet });
  const home = renderer.render(renderer.routes().find((r) => r.url === '/'));
  assert.match(home, /href="tel:\+49/);
  assert.match(home, /<form class="contact-form" action="\/api\/kontakt" method="post"/);
  assert.doesNotMatch(home, /demo-bar|name="robots"/);
  const legal = renderer.render(renderer.routes().find((r) => r.url === '/impressum/'));
  assert.match(legal, /name="robots" content="noindex"/);
  assert.match(legal, /class="placeholder"/); // Vorlage-Gliederung
});

test('Demo-Build (R1–R12): alle Seiten noindex, Hinweisleiste, nichts wählt oder sendet', { skip: !hasImages }, () => {
  const options = buildOptions('demo', { ...OPERATOR_ENV, BASE: '/repo/' });
  const renderer = createRenderer({ ...options, ...quiet });
  for (const route of renderer.routes()) {
    const html = renderer.render(route);
    const where = route.url;
    assert.match(html, /<meta name="robots" content="noindex">/, `${where}: noindex`);
    assert.match(
      html,
      /class="demo-bar"[\s\S]*fiktiver Betrieb[\s\S]*href="\/repo\/impressum\/"/,
      `${where}: Hinweisleiste`,
    );
    // Einzige tel:-Links: die echte Nummer des Betreibers (Impressum, Datenschutz)
    for (const [, tel] of html.matchAll(/href="tel:([^"]*)"/g))
      assert.equal(tel, '+49301234567', `${where}: tel:${tel}`);
    assert.doesNotMatch(html, /action="|method="post"|data-endpoint|type="submit"/, `${where}: Formular sendet`);
    assert.doesNotMatch(html, /href="#"|\{\{|class="placeholder"/, `${where}: Platzhalter`);
    // Links mit Basispfad (Assets wie /css/main.css oder /img/… ergänzt Vite beim Build)
    assert.doesNotMatch(html, /<a [^>]*href="\/(?!repo\/|img\/)/, `${where}: Link ohne Basispfad`);
  }
  const impressum = renderer.render(renderer.routes().find((r) => r.url === '/impressum/'));
  assert.match(impressum, /Erika Test<br>Teststraße 1<br>10115 Berlin/);
  assert.match(impressum, /href="mailto:erika@test\.example"/);
  assert.match(
    impressum,
    /id="demo"[\s\S]*ist ein fiktiver Betrieb\. Alle Firmendaten, Kundenstimmen und Bewertungen sind erfunden\./,
  );
  assert.match(impressum, /Bildnachweise[\s\S]*unsplash\.com\/photos\//);
  const privacy = renderer.render(renderer.routes().find((r) => r.url === '/datenschutz/'));
  assert.match(privacy, /GitHub, Inc\.[\s\S]*Data Privacy Framework[\s\S]*Art\. 77/);
  assert.match(privacy, /Berliner Beauftragte für Datenschutz/);
  // Betreiberdaten nur auf den Rechtsseiten
  const home = renderer.render(renderer.routes().find((r) => r.url === '/'));
  assert.doesNotMatch(home, /Erika|Teststraße/);
});
