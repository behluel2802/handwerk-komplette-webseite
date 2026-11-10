// Bildnachweise für das Impressum, gelesen aus der Tabelle in img-src/CREDITS.md (eine Quelle für Repo und Website).
// Erwartete Spalten: Datei(en) | Motiv | Fotograf | Quelle | Bearbeitung – Fotograf und Quelle als Markdown-Link.
import { readFileSync } from 'node:fs';

const FILE = new URL('../img-src/CREDITS.md', import.meta.url);
const LINK = /^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/;

/**
 * @typedef {{ motif: string, author: string, authorUrl: string, sourceUrl: string, edits: string }} Credit
 */

/** @returns {Credit[]} */
export function loadCredits() {
  const rows = readFileSync(FILE, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .slice(2) // Kopfzeile und Trennzeile
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  return rows.map((cells, i) => {
    const [, motif, author, source, edits] = cells;
    const a = LINK.exec(author ?? '');
    const s = LINK.exec(source ?? '');
    if (cells.length !== 5 || !motif || !a || !s) {
      throw new Error(
        `img-src/CREDITS.md, Tabellenzeile ${i + 1}: erwartet „Datei | Motiv | [Fotograf](URL) | [Quelle](URL) | Bearbeitung“`,
      );
    }
    return { motif, author: a[1], authorUrl: a[2], sourceUrl: s[2], edits };
  });
}
