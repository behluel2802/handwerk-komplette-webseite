// Seitengenerator: rendert alle Seiten mit Handlebars und speist sie als HTML-Einstiege in Vite ein.
//
// Quellen
//   pages/**/index.hbs     eine Seite je Ordner, Ordner = URL (pages/kontakt/index.hbs → /kontakt/), dazu pages/404.hbs
//   templates/<typ>.hbs    Template je Seitentyp, gerendert für jeden Eintrag einer Content-Sammlung (scripts/content.js)
//   partials/**/*.hbs      wiederverwendbare Teile, Name = Pfad ohne .hbs ({{> legal/impressum-demo}})
//   partials/layout.hbs    umschließt jede Seite ({{{body}}}): Kopf, Header, Footer, Anruf-Leiste
//
// Seiten tragen ihre Metadaten als Front-Matter (YAML zwischen ---). Texte darin dürfen Handlebars enthalten
// ({{site.address.city}}). Das Schema steht unten in PAGE_SCHEMA.
//
// Vite-Anbindung: Im Build bekommt jede Seite einen virtuellen Einstieg (frontend/<pfad>/index.html, existiert nicht
// auf der Platte; resolveId/load liefern das gerenderte HTML). Vite verarbeitet ihn wie eine echte HTML-Datei
// (Assets mit Hash, CSS/JS-Bundle). Im Dev-Server rendert eine Middleware die Seite bei jedem Aufruf neu.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Handlebars from 'handlebars';
import matter from 'gray-matter';
import { COLLECTIONS, loadCollections } from './content.js';
import { loadCredits } from './credits.js';
import { boolean, object, optional, string } from './schema.js';
import { loadSite, siteHelpers } from './site.js';

const root = path.resolve(import.meta.dirname, '..');
const dirs = {
  pages: path.join(root, 'pages'),
  partials: path.join(root, 'partials'),
  templates: path.join(root, 'templates'),
};
// Änderungen hier lösen im Dev-Server ein Neuladen aus
const WATCH = [
  ...Object.values(dirs),
  path.join(root, 'content'),
  path.join(root, 'site.json'),
  path.join(root, 'img-src/CREDITS.md'),
];

const PAGE_SCHEMA = object({
  title: string({ max: 70 }),
  titleSuffix: optional(boolean()), // false: Titel ohne „ – Firmenname“ (Startseite)
  description: string({ min: 50, max: 160 }),
  robots: optional(string({ oneOf: ['noindex'] })),
  callBar: optional(boolean()), // false: keine mobile Anruf-Leiste (Rechtsseiten)
  bodyClass: optional(string()),
});

/**
 * @typedef {object} Route
 * @property {string} url     z. B. /leistungen/smart-home/ oder /404.html
 * @property {string} output  Datei in dist/, z. B. leistungen/smart-home/index.html
 * @property {string} source  Quelldatei (Seite bzw. Template), relativ zu frontend/
 * @property {string} [collection]
 * @property {string} [slug]
 */

const walk = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.hbs'))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'));

/** Alle Routen: Seiten aus pages/ und Einträge der Content-Sammlungen */
export function listRoutes(collections = loadCollections()) {
  /** @type {Route[]} */
  const routes = walk(dirs.pages).map((file) => {
    if (file === '404.hbs') return { url: '/404.html', output: '404.html', source: `pages/${file}` };
    if (!file.endsWith('index.hbs')) {
      throw new Error(`pages/${file}: Seiten als Ordner anlegen (pages/<url>/index.hbs), damit die URL auf / endet`);
    }
    const dir = file.slice(0, -'index.hbs'.length);
    return { url: `/${dir}`, output: `${dir}index.html`, source: `pages/${file}` };
  });
  for (const [name, entries] of Object.entries(collections)) {
    for (const entry of entries) {
      routes.push({
        url: entry.url,
        output: `${entry.url.slice(1)}index.html`,
        source: `templates/${COLLECTIONS[name].template}`,
        collection: name,
        slug: entry.slug,
      });
    }
  }
  const seen = new Map();
  for (const r of routes) {
    if (seen.has(r.url)) throw new Error(`URL ${r.url} doppelt: ${seen.get(r.url)} und ${r.source}`);
    seen.set(r.url, r.source);
  }
  return routes.sort((a, b) => a.url.localeCompare(b.url));
}

/**
 * Bild-Helfer. Datenquelle: img/manifest.json (erzeugt von scripts/images.js).
 * Pfade absolut ab der Website-Wurzel; Vite ersetzt sie beim Build durch die gehashten Dateien (inkl. Basispfad).
 */
function imageHelpers() {
  let cache;
  const manifest = () => (cache ??= JSON.parse(readFileSync(path.join(root, 'img/manifest.json'), 'utf8')));
  const variants = (name, set) => {
    const found = manifest().images[name]?.[set];
    if (!found) throw new Error(`Bild "${name}" / Satz "${set}" fehlt in images.config.js`);
    return found;
  };
  return {
    // "/img/ref-bad-tile-400.avif 400w, /img/ref-bad-tile-600.avif 600w, …"
    srcset: (name, set, format) =>
      variants(name, set)
        .map((v) => `/img/${v.file}.${format} ${v.width}w`)
        .join(', '),
    // kleinste Variante (bzw. einzige, z. B. Lightbox-Bild)
    src: (name, set, format) => `/img/${variants(name, set)[0].file}.${format}`,
    // Maße der kleinsten Variante für width/height (Seitenverhältnis, verhindert Layout-Sprünge)
    dim: (name, set, key) => variants(name, set)[0][key],
    sourceFormats: () => manifest().formats.slice(0, -1),
    fallbackFormat: () => manifest().formats.at(-1),
  };
}

/**
 * @param {import('./env.js').BuildOptions & { warn?: (message: string) => void }} options
 */
export function createRenderer({ base, demo, operator, warn = console.warn }) {
  const url = (target) => `${base}${String(target).replace(/^\//, '')}`;

  /** Rendert eine Route zu vollständigem HTML */
  function render(/** @type {Route} */ route) {
    const site = loadSite({ warn });
    const collections = loadCollections();
    const hbs = Handlebars.create();

    for (const file of walk(dirs.partials)) {
      hbs.registerPartial(file.replace(/\.hbs$/, ''), readFileSync(path.join(dirs.partials, file), 'utf8'));
    }

    hbs.registerHelper({
      ...imageHelpers(),
      ...siteHelpers,
      // Link innerhalb der Website mit Basispfad: {{url "/kontakt/"}}, {{url "/#leistungen"}}
      url,
      // Anruf-Link. Demo: wählt nicht, sondern führt zum Hinweis auf die fiktiven Nummern (Briefing R7)
      tel: (number) => (demo ? url('/impressum/#demo') : `tel:${number.tel}`),
      eq: (a, b) => a === b,
      // aria-current für Links auf die aktuelle Seite: <a href="…"{{current "/impressum/"}}>
      current: (target) => new Handlebars.SafeString(target === route.url ? ' aria-current="page"' : ''),
    });

    const source = readFileSync(path.join(root, route.source), 'utf8');
    const ctx = { site, demo, operator, collections, base };

    let page;
    let body;
    if (route.collection) {
      const entry = collections[route.collection].find((e) => e.slug === route.slug);
      page = { ...entry, url: route.url };
      body = source;
    } else {
      const { data, content } = matter(source);
      // Texte im Front-Matter dürfen Handlebars enthalten (z. B. {{site.address.city}})
      const fields = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? hbs.compile(v, { noEscape: true })(ctx) : v]),
      );
      const errors = PAGE_SCHEMA(fields, '');
      if (errors.length) throw new Error(`${route.source}: Front-Matter ungültig:\n  ${errors.join('\n  ')}`);
      page = { ...fields, url: route.url };
      body = content;
    }
    page.isHome = route.url === '/';
    page.noindex = demo || page.robots === 'noindex';
    page.callBar = page.callBar !== false;
    page.fullTitle = page.titleSuffix === false ? page.title : `${page.title} – ${site.name}`;

    const pageCtx = { ...ctx, page, credits: loadCredits() };
    const html = hbs.compile(body)(pageCtx);
    return hbs.compile('{{> layout}}')({ ...pageCtx, body: new Handlebars.SafeString(html) });
  }

  return { render, routes: () => listRoutes(), url };
}

/**
 * Vite-Plugin
 * @param {import('./env.js').BuildOptions & { warn?: (message: string) => void }} options
 * @returns {import('vite').Plugin}
 */
export function pages(options) {
  const renderer = createRenderer(options);
  const fileOf = (/** @type {Route} */ r) => path.join(root, r.output);
  const byFile = () => new Map(renderer.routes().map((r) => [fileOf(r), r]));
  let isBuild = false;

  return {
    name: 'eb-pages',
    enforce: 'pre',

    config(_, { command }) {
      isBuild = command === 'build';
      if (!isBuild) return;
      // Einstiegsname = Ausgabepfad ohne .html (leistungen/smart-home/index)
      const input = Object.fromEntries(renderer.routes().map((r) => [r.output.replace(/\.html$/, ''), fileOf(r)]));
      return { build: { rollupOptions: { input } } };
    },

    resolveId(id) {
      return isBuild && byFile().has(path.normalize(id)) ? path.normalize(id) : null;
    },

    load(id) {
      if (!isBuild) return null;
      const route = byFile().get(id);
      if (!route) return null;
      const html = renderer.render(route);
      // Vorlage-Rechtsseiten mit Platzhaltern dürfen nicht online: im normalen Build deutlich warnen
      if (!options.demo && html.includes('class="placeholder"')) {
        (options.warn ?? console.warn)(`[recht] ${route.url} enthält Platzhalter – vor der Veröffentlichung ausfüllen`);
      }
      return html;
    },

    configureServer(server) {
      const { base } = options;
      server.watcher.add(WATCH);
      const reload = (file) => {
        if (WATCH.some((w) => file === w || file.startsWith(w + path.sep))) server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload).on('add', reload).on('unlink', reload);

      const send = async (req, res, route, status = 200) => {
        const html = await server.transformIndexHtml(req.url, renderer.render(route), req.originalUrl);
        res.statusCode = status;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      };

      // Vor den Vite-eigenen Middlewares: Seiten rendern, /pfad → /pfad/ wie im Backend
      server.middlewares.use(async (req, res, next) => {
        try {
          const { pathname, search } = new URL(req.url ?? '/', 'http://localhost');
          if (!pathname.startsWith(base)) return next();
          const local = `/${decodeURIComponent(pathname).slice(base.length)}`;
          const routes = renderer.routes();
          const route = routes.find((r) => r.url === local);
          if (route) return await send(req, res, route);
          if (routes.some((r) => r.url === `${local}/`)) {
            res.writeHead(301, { Location: `${pathname}/${search}` });
            return res.end();
          }
          next();
        } catch (error) {
          next(error);
        }
      });

      // Danach (nichts gefunden): 404-Seite für Seitenaufrufe
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const notFound = renderer.routes().find((r) => r.url === '/404.html');
          if (!notFound || !req.headers.accept?.includes('text/html')) return next();
          try {
            await send(req, res, notFound, 404);
          } catch (error) {
            next(error);
          }
        });
      };
    },
  };
}
