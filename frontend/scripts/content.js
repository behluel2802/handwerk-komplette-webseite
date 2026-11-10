// Content-Sammlungen: gleichartige Seiten (Leistungen, später Stellen und Projekte) aus Dateien in content/<sammlung>/.
// Jede Datei ist Markdown mit Front-Matter (YAML): Felder oben, Fließtext darunter.
// Dateiname = URL-Teil: content/leistungen/smart-home.md → /leistungen/smart-home/
// Felder werden beim Build per Schema geprüft (scripts/schema.js); Fehler brechen mit Datei und Feld ab.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { ANLIEGEN } from '../js/validate.js';
import { array, integer, object, optional, string } from './schema.js';

const root = path.resolve(import.meta.dirname, '..');

// Icons aus dem Sprite (partials/sprite.hbs): Content darf nur vorhandene verwenden
const ICONS = [
  ...readFileSync(path.join(root, 'partials/sprite.hbs'), 'utf8').matchAll(/<symbol id="i-([\w-]+)"/g),
].map((m) => m[1]);

// Gemeinsame Felder jeder Seite (Suchergebnis-Titel und -Beschreibung)
const meta = {
  title: string({ max: 60 }),
  description: string({ min: 50, max: 160 }),
};

/**
 * @typedef {object} Collection
 * @property {string} dir       Ordner unter content/
 * @property {string} template  Template unter templates/
 * @property {(slug: string) => string} url  URL der Einzelseite
 * @property {import('./schema.js').Check} schema  Prüfung der Front-Matter-Felder
 */

/** @type {Record<string, Collection>} */
export const COLLECTIONS = {
  leistungen: {
    dir: 'leistungen',
    template: 'leistung.hbs',
    url: (slug) => `/leistungen/${slug}/`,
    schema: object({
      ...meta,
      heading: string({ max: 80 }), // h1, darf länger sein als der Titel
      teaser: string({ max: 140 }), // Karte in der Übersicht und Einleitung
      icon: string({ oneOf: ICONS }),
      anliegen: string({ oneOf: ANLIEGEN }), // Vorbelegung im Kontaktformular
      order: integer({ min: 1 }),
      faq: optional(
        array(object({ frage: string({ max: 120 }), antwort: string({ max: 600 }) }), {
          max: 8,
        }),
      ),
    }),
  },
};

const md = new MarkdownIt({ html: false, typographer: true, quotes: '„“‚‘' });
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {Record<string, any> & { slug: string, url: string, html: string, file: string }} Entry
 */

/**
 * Liest und prüft alle Einträge einer Sammlung, sortiert nach `order` (falls vorhanden), sonst nach Slug.
 * @param {string} name
 * @returns {Entry[]}
 */
export function loadCollection(name) {
  const collection = COLLECTIONS[name];
  const dir = path.join(root, 'content', collection.dir);
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  /** @type {string[]} */
  const errors = [];
  /** @type {Entry[]} */
  const entries = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const rel = path.relative(root, path.join(dir, file));
    const { data, content } = matter(readFileSync(path.join(dir, file), 'utf8'));
    if (!SLUG.test(slug)) errors.push(`${rel}: Dateiname nur aus a–z, 0–9 und Bindestrichen`);
    errors.push(...collection.schema(data, '').map((e) => `${rel}: ${e}`));
    if (!content.trim()) errors.push(`${rel}: Fließtext (Markdown unter dem Front-Matter) fehlt`);
    return { ...data, slug, url: collection.url(slug), html: md.render(content), file: rel };
  });
  if (errors.length) throw new Error(`Content-Fehler in „${name}“:\n  ${errors.join('\n  ')}`);
  return entries.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.slug.localeCompare(b.slug));
}

/** Alle Sammlungen: { leistungen: [...], … } */
export const loadCollections = () =>
  Object.fromEntries(Object.keys(COLLECTIONS).map((name) => [name, loadCollection(name)]));
