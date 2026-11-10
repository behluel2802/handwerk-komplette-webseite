# CLAUDE.md

Mehrseitige Website-Vorlage für einen **fiktiven Elektro-Meisterbetrieb** (Übungs- und Vorzeigeprojekt). Phase 1 war ein One-Pager, Phase 2 baut ihn zur vollständigen Website aus. Das vollständige Briefing mit Zielen, Zielgruppe, Abschnitten und Entscheidungen steht in [docs/BRIEFING.md](docs/BRIEFING.md). Vor jeder Arbeit lesen und bei neuen Entscheidungen aktualisieren. [docs/LEITFADEN.md](docs/LEITFADEN.md) ist die eigenständige Anleitung für neue Projekte: neue allgemeine Erkenntnisse (Entscheidungen, Stolpersteine) dort ergänzen, ohne auf das Briefing zu verweisen.

**Aktueller Stand und nächster Schritt:** Abschnitt „7. Vorgehen und Stand“ in `docs/BRIEFING.md`. Zu Beginn einer neuen Sitzung dort nachsehen und den Entwickler kurz an den offenen Punkt erinnern. Nach jedem abgeschlossenen Schritt die Statustabelle aktualisieren.

## Seiten

Sitemap, Seiteninhalte und Grundsatzentscheidungen: `docs/BRIEFING.md` Abschnitt 5.1 und 7 (Phase 2). Kurz: Startseite (Teaser) · Leistungen + 5 Detailseiten · `/notdienst/` · Referenzen · Über uns · Karriere + Seite je Stelle · Kontakt · Impressum/Datenschutz/Danke · 404.
- Ordner-URLs mit Schrägstrich am Ende (`/leistungen/smart-home/`), keine `.html` in Links. Keine Ortsseiten, kein Blog.
- Alle Seiten nutzen dasselbe Layout (Header mit Navigation, Breadcrumbs auf Unterseiten, Footer mit Sitemap). CTA-Box auf jeder Seite.
- Google-Bewertungen bzw. das Google-Profil gut sichtbar verlinken. Keine Preise. Kein Team-Raster mit erfundenen Personen.
- Inhalte der Unterseiten dürfen als realistische Platzhalter erfunden werden, Stammdaten (`site.json`) nicht.

## Kommunikation

- Auf **Deutsch** antworten.
- Der Entwickler ist erfahren, technische Erklärungen kurz halten.
- **Nichts committen oder pushen ohne ausdrückliche Anweisung.**
- Erst umsetzen, wenn der Entwickler das Go gibt. Bei offenen Grundsatzfragen nachfragen.

## Technische Leitplanken

- Stack bleibt bewusst schlank: kein Framework, keine Datenbank, kein CMS, kein Tailwind/Präprozessor (Begründung im Briefing).
- Seiten erzeugt `frontend/scripts/pages.js` (eigenes Vite-Plugin, Handlebars): Einzelseiten als `frontend/pages/<url>/index.hbs` mit Front-Matter (`title`, `description`, optional `robots: noindex`, `callBar`, `bodyClass`; Schema im Plugin), dazu `pages/404.hbs`. Ordner = URL, keine Liste von Hand pflegen.
- Gleichartige Seiten (Leistungen, Stellen, Projekte) entstehen aus Content-Dateien `frontend/content/<sammlung>/<slug>.md` (Front-Matter + Markdown) und einem Template je Seitentyp in `frontend/templates/`; Sammlungen und ihr Schema stehen in `frontend/scripts/content.js`, der Build bricht bei Fehlern ab. Nie gleichartige Seiten von Hand kopieren.
- Frontend: HTML, CSS und Vanilla JS, kein Framework. Build mit **Vite**: Quellen in `frontend/`, Ausgabe `frontend/dist/`. Jede Seite läuft durch `partials/layout.hbs` (Kopf, Header, Footer, Anruf-Leiste); wiederkehrende Teile als Partials in `frontend/partials/`, nie in Seiten kopieren.
- Interne Links immer mit `{{url "/kontakt/"}}` (Basispfad `BASE`), Anruf-Links immer mit `href="{{tel site.phone}}"` (wählt in der Demo nicht), `aria-current` mit `{{current "/pfad/"}}`. Bilder/Assets absolut ab Wurzel (`/img/…`, `/css/main.css`), Vite ergänzt den Basispfad.
- JS: `js/main.js` läuft überall; seitenabhängige Module (Lightbox, Formular, Erreichbarkeit) lädt es per `import()` nur, wenn ihr `data-*`-Element existiert (Liste `ON_DEMAND`).
- npm-Workspaces im Hauptordner (`frontend`, `backend`): `npm run dev` (Vite :5173 + Backend :3000), `npm run build`, `npm run build:demo`, `npm start`, `npm test`, `npm run lint`, `npm run format`, `npm run typecheck` (JSDoc, `tsc --checkJs` für `frontend/scripts`). Abhängigkeiten im Frontend nur als devDependencies (laufen nur beim Bauen).
- Backend: Node.js in `backend/` (möglichst wenige Abhängigkeiten, Konfiguration über `.env`, nie ins Repo). Ausgeliefert wird ausschließlich `frontend/dist/`; `.env`, `backend/`, `docs/`, Quellen und Punkt-Dateien dürfen nie per Browser erreichbar sein.
- Mobile-first, semantisches HTML, barrierearm.
- Farben, Schriften und Abstände als CSS-Variablen in `:root` (Design-Tokens), damit die Vorlage für andere Gewerke umfärbbar bleibt. Hauptfarbe dunkles Blau, Akzent Gelb/Bernstein.
- DSGVO: keine externen CDNs, keine Google Fonts per Link, keine Tracker. Alles wird lokal ausgeliefert.
- Bilder: freie Unsplash-Fotos, Original nach `frontend/img-src/` (kein Hotlinking), Größen/Formate/Ausschnitte in `frontend/images.config.js` eintragen; `npm run images` (läuft automatisch vor dev/build) erzeugt sie nach `frontend/img/` (generiert, nicht im Repo). Im HTML mit `width`/`height` und `alt`. Fotograf und Link in `frontend/img-src/CREDITS.md`. Im HTML nie Bildpfade oder Größen von Hand schreiben: `{{> picture name="…" set="…" sizes="…" alt="…"}}` bzw. die Helfer `srcset`/`src`/`dim` (Daten aus `img/manifest.json`). Favicon/App-Icon entstehen aus `frontend/img-src/icon.svg`.
- Qualität: Barrierefreiheit (Lighthouse/axe) muss 100 bleiben, der Workflow „Qualität“ prüft bei jedem Push. Neue Dateitypen im Build brauchen einen Eintrag in `MIME` in `backend/server.js` (Test prüft das).
- Öffentliche Demo (`npm run build:demo`, Vite-Modus `demo`, Optionen in `frontend/scripts/env.js`): Betreiberdaten (`OPERATOR_*`, alle Pflicht inkl. Telefon) nie ins Repo, lokal in `frontend/.env.demo.local`, in GitHub als Repository-Variablen. Im Demo-Modus senden Formulare nichts (`__DEMO__` im JS, ohne JS kein Absende-Button), Anruf-Buttons führen zu `/impressum/#demo`, Hinweisleiste und `noindex` auf allen Seiten, Rechtsseiten in Demo-Fassung (`partials/legal/*-demo.hbs`); Templates unterscheiden mit `{{#if demo}}`. Tests in `frontend/test/` sichern das ab (Briefing R1–R14).
- Kontaktformular: JS-Validierung im Frontend, Versand an das eigene Backend (`/api/kontakt`), keine externen Formular-Dienste. Fehlt das Backend, zeigt das Formular einen Fehler, nie eine falsche Bestätigung; nicht senden darf nur der Demo-Build. Ohne JS: `/danke/` bzw. `/anfrage-fehler/` (Backend setzt die Meldung ein).
- Firmendaten (fiktiv: Elektro Berger GmbH, Musterstadt) stehen ausschließlich in `frontend/site.json` (Kontext `site` in Seiten/Partials, z. B. `{{site.phone.display}}`; JSON-LD wird daraus erzeugt). Nie Name, Adresse, Telefon, Öffnungszeiten o. Ä. direkt ins HTML/JS schreiben, nichts Neues erfinden. Fehlende Werte als `null` (Text ohne Link), nie `href="#"`.
- CSS-Aufteilung (in `frontend/`, Vite fasst beim Build zu einer Datei zusammen): Einstieg `css/main.css` (nur `@import`s), `css/tokens.css` (nur Variablen), `css/base.css` (Reset, Typografie, Layout-Helfer, Buttons), `css/components/<komponente>.css` (eine Datei je Komponente, neue in `main.css` eintragen). Neue Werte zuerst als Token anlegen, keine hartkodierten Farben in den Komponenten.
