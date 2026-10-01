// Turning DOM events into intents. The pure parts live here so they can be tested without a browser.

/** Dataset keys the Hud reads itself; they never become intent payload. */
const RESERVED = new Set(['intent', 'collect', 'localSet', 'localScope', 'key', 'focusKey']);

/** Payload keys that arrive as digits and are numbers in the intent contract. */
const NUMERIC = new Set(['tier', 'index', 'c', 'r', 'x', 'y']);

/** Payload keys that hold comma separated id lists. */
const LISTS = new Set(['unitIds']);

/**
 * Convert an element's dataset into an intent: `{ intent: 'recruit', cardId: 'c1' }` -> `{ type: 'recruit', cardId: 'c1' }`.
 * @param {Record<string, string | undefined>} dataset
 * @returns {{ type: string, [key: string]: any } | null}
 */
export function intentFromDataset(dataset) {
  const type = dataset.intent;
  if (!type) return null;
  const intent = { type };
  for (const [key, value] of Object.entries(dataset)) {
    if (RESERVED.has(key) || value === undefined) continue;
    if (LISTS.has(key)) intent[key] = value.split(',').filter(Boolean);
    else intent[key] = NUMERIC.has(key) && /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return intent;
}

/**
 * Merge form values (`name -> value`) into an intent according to its type. Seeds become numbers
 * (empty means random), unit id lists are split on commas.
 * @param {{ type: string }} intent
 * @param {Record<string, string>} form
 */
export function applyForm(intent, form) {
  const merged = { ...intent, ...form };
  if (intent.type === 'startGame') {
    const seed = String(form.seed ?? '').trim();
    merged.seed = /^\d+$/.test(seed) ? Number(seed) : null;
  }
  return merged;
}

/**
 * Read every named, enabled control under `root`. Radios only count when checked.
 * @param {{ querySelectorAll: Function }} root
 * @returns {Record<string, string>}
 */
export function readForm(root) {
  const values = {};
  for (const el of root.querySelectorAll('input[name], select[name], textarea[name]')) {
    if (el.disabled) continue;
    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) continue;
    values[el.name] = el.value;
  }
  return values;
}
