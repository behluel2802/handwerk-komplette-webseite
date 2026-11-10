// Kleine Schema-Prüfung für Content-Dateien (ohne Abhängigkeit).
// Ein Schema ist ein Prüfer: (wert, pfad) => Liste von Fehlermeldungen. Unbekannte Felder sind ein Fehler (Tippfehler fallen auf).
//
//   const schema = object({ title: string({ max: 60 }), faq: optional(array(object({ frage: string() }))) });
//   const errors = schema(data, '');  // → ['faq[0].frage: Text erwartet', …]

/** @typedef {(value: unknown, path: string) => string[]} Check */

const at = (path) => path || '(Wurzel)';
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Text, standardmäßig nicht leer.
 * @param {{ min?: number, max?: number, pattern?: RegExp, oneOf?: readonly string[] }} [options]
 * @returns {Check}
 */
export function string({ min = 1, max, pattern, oneOf } = {}) {
  return (v, path) => {
    if (typeof v !== 'string') return [`${at(path)}: Text erwartet`];
    const text = v.trim();
    if (text.length < min) return [`${at(path)}: mindestens ${min} Zeichen (ist ${text.length})`];
    if (max !== undefined && text.length > max) return [`${at(path)}: höchstens ${max} Zeichen (ist ${text.length})`];
    if (pattern && !pattern.test(text)) return [`${at(path)}: Format ungültig (${pattern})`];
    if (oneOf && !oneOf.includes(text)) return [`${at(path)}: einer von ${oneOf.join(', ')} erwartet, ist „${text}“`];
    return [];
  };
}

/**
 * Ganzzahl.
 * @param {{ min?: number, max?: number }} [options]
 * @returns {Check}
 */
export function integer({ min, max } = {}) {
  return (v, path) => {
    if (!Number.isInteger(v)) return [`${at(path)}: Ganzzahl erwartet`];
    const n = /** @type {number} */ (v);
    if (min !== undefined && n < min) return [`${at(path)}: mindestens ${min}`];
    if (max !== undefined && n > max) return [`${at(path)}: höchstens ${max}`];
    return [];
  };
}

/** @returns {Check} */
export const boolean = () => (v, path) => (typeof v === 'boolean' ? [] : [`${at(path)}: true oder false erwartet`]);

/**
 * Liste mit Prüfung je Eintrag.
 * @param {Check} item
 * @param {{ min?: number, max?: number }} [options]
 * @returns {Check}
 */
export function array(item, { min = 0, max } = {}) {
  return (v, path) => {
    if (!Array.isArray(v)) return [`${at(path)}: Liste erwartet`];
    if (v.length < min) return [`${at(path)}: mindestens ${min} Einträge`];
    if (max !== undefined && v.length > max) return [`${at(path)}: höchstens ${max} Einträge`];
    return v.flatMap((entry, i) => item(entry, `${path}[${i}]`));
  };
}

/** Markiert ein Feld in object() als optional (fehlend oder null). */
export function optional(check) {
  /** @type {Check & { optional?: true }} */
  const wrapped = (v, path) => (v === undefined || v === null ? [] : check(v, path));
  wrapped.optional = true;
  return wrapped;
}

/**
 * Objekt mit festen Feldern; unbekannte Felder sind Fehler.
 * @param {Record<string, Check & { optional?: true }>} shape
 * @returns {Check}
 */
export function object(shape) {
  return (v, path) => {
    if (!isPlainObject(v)) return [`${at(path)}: Objekt erwartet`];
    const obj = /** @type {Record<string, unknown>} */ (v);
    const prefix = path ? `${path}.` : '';
    const errors = Object.keys(obj)
      .filter((key) => !(key in shape))
      .map((key) => `${prefix}${key}: unbekanntes Feld (erlaubt: ${Object.keys(shape).join(', ')})`);
    for (const [key, check] of Object.entries(shape)) {
      if (obj[key] === undefined && !check.optional) errors.push(`${prefix}${key}: Pflichtfeld fehlt`);
      else errors.push(...check(obj[key], `${prefix}${key}`));
    }
    return errors;
  };
}
