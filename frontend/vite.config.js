// Vite: baut die Quellen in frontend/ nach frontend/dist/.
// Seiten entstehen aus pages/, templates/ und content/ (scripts/pages.js) – keine Liste von Hand pflegen.
//
//   npm run dev          http://localhost:5173, /api wird an das Backend auf :3000 weitergereicht
//   npm run build        Vorlage für echte Betriebe (Rechtsseiten mit Platzhaltern, nicht veröffentlichen)
//   npm run build:demo   öffentliche Demo: Betreiber-Impressum, Formulare senden nichts, noindex (scripts/env.js)
//   BASE=/pfad/ …        Basispfad, z. B. für GitHub Pages
import { defineConfig, loadEnv } from 'vite';
import { buildOptions } from './scripts/env.js';
import { pages } from './scripts/pages.js';

const root = import.meta.dirname;

// Warnungen (z. B. fehlender Google-Link) nur einmal ausgeben
const warned = new Set();
const warnOnce = (message) => {
  if (!warned.has(message)) console.warn(message);
  warned.add(message);
};

export default defineConfig(({ mode }) => {
  // .env, .env.local, .env.[mode], .env.[mode].local aus frontend/ plus echte Umgebungsvariablen
  const options = buildOptions(mode, { ...loadEnv(mode, root, ''), ...process.env });

  return {
    base: options.base,
    appType: 'mpa',

    // Im Browser-Code: if (__DEMO__) … (wird beim Build durch true/false ersetzt)
    define: { __DEMO__: JSON.stringify(options.demo) },

    html: {
      // Lightbox-Links auf die großen Referenzfotos ebenfalls als Assets behandeln (Hash im Dateinamen)
      additionalAssetSources: {
        a: { srcAttributes: ['href', 'data-full'], filter: ({ attributes }) => 'data-full' in attributes },
      },
    },

    plugins: [pages({ ...options, warn: warnOnce })],

    server: {
      proxy: { '/api': 'http://localhost:3000' },
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Keine Bilder als data:-URI ins HTML: einheitlich als Datei, dauerhaft cachebar
      assetsInlineLimit: 0,
    },
  };
});
