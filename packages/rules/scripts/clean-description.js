// Turns Foundry's rules text (its inline tags and all) into the plain HTML the data uses.

const ALLOWED_TAGS = new Set(['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h2', 'h3', 'h4']);
const SAVES = ['fortitude', 'reflex', 'will'];

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * Replaces each tag starting with `open`, plus any {label} after it. Damage and roll
 * tags nest brackets ("@Damage[(1[splash])[cold]]"), so this counts them to find the end.
 * render(body, label) returns the text to use.
 */
function replaceNested(html, open, render) {
  const closes = open.split('[').length - 1;
  let out = '';
  let from = 0;
  for (let at = html.indexOf(open); at >= 0; at = html.indexOf(open, from)) {
    let i = at + open.length;
    for (let depth = closes; i < html.length && depth > 0; i++) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') depth--;
    }
    const label = /^\{([^}]+)\}/.exec(html.slice(i));
    out += html.slice(from, at) + render(html.slice(at + open.length, i - closes), label?.[1]);
    from = i + (label ? label[0].length : 0);
  }
  return out + html.slice(from);
}

/** Splits on a separator outside any brackets or parentheses. */
function splitTopLevel(text, separators) {
  const parts = [''];
  let depth = 0;
  for (const c of text) {
    if ('[('.includes(c)) depth++;
    if ('])'.includes(c)) depth--;
    if (separators.includes(c) && depth === 0) parts.push(c === ',' ? '' : c);
    else parts[parts.length - 1] += c;
  }
  return parts;
}

const MATH = { floor: Math.floor, ceil: Math.ceil, max: Math.max, min: Math.min, ternary: (c, a, b) => (c ? a : b), gte: (a, b) => a >= b, gt: (a, b) => a > b, lte: (a, b) => a <= b, lt: (a, b) => a < b, eq: (a, b) => a === b };

/** The value of an arithmetic formula from the rules data, or null if it isn't one. */
function evaluate(formula) {
  const words = formula.match(/[a-z]+/gi) ?? [];
  if (!/^[\d\s+\-*/(),.a-z]+$/i.test(formula) || !words.every((w) => w in MATH)) return null;
  return new Function(...Object.keys(MATH), `return (${formula});`)(...Object.values(MATH));
}

// Formulas that scale with the character, which the data can't work out ahead of time.
const ACTOR_FORMULAS = [
  [/\(?ceil\(@actor\.level\/2\)\)?d(\d+)/g, '1d$1 per 2 levels (rounded up)'],
  [/\(?2\*\(1\+@actor\.level\)\)?/g, '2 × (1 + your level)'],
  [/@(actor|self)\.level/g, 'your level'],
];

/** Works out a dice formula at the spell's rank: "(floor(@item.level/2))d6" at rank 4 to "2d6". */
function diceText(formula, vars) {
  const known = formula.replace(/@item\.(level|rank)/g, (_m, v) => vars[v] ?? _m);
  if (known.includes('@')) return known;
  const whole = /^\((.*)\)$/.exec(known.trim());
  const body = whole && splitTopLevel(whole[1], '').length === 1 && !/^[^(]*\)/.test(whole[1]) && /d\d/.test(whole[1]) ? whole[1] : known;
  let scalar = 0;
  const dice = [];
  for (const term of splitTopLevel(body.replace(/\s+/g, ''), '+-').filter(Boolean)) {
    const die = /^([+-]?)(.*)d(\d+)$/.exec(term);
    if (die) {
      const count = die[2] === '' ? 1 : evaluate(die[2]);
      if (count === null) return known;
      dice.push(`${count}d${die[3]}`);
    } else {
      const value = evaluate(term);
      if (value === null) return known;
      scalar += value;
    }
  }
  if (!dice.length) return String(scalar);
  return `${dice.join('+')}${scalar > 0 ? `+${scalar}` : scalar < 0 ? scalar : ''}`;
}

/** "3d6[fire]|options:area-damage" to "3d6 fire"; "(1[splash])[cold]" to "1 cold" (the text says splash). */
function damageText(expr, vars) {
  return splitTopLevel(expr.split('|')[0], ',')
    .map((part) => {
      const d = part.replace(/\(([^()]*)\[splash\]\)/g, '$1');
      const typed = /^(.*)\[([^\]]+)\]$/.exec(d);
      const formula = typed && !typed[1].includes('[') ? typed[1] : typed ? null : d;
      if (formula === null) return d.replace(/\[([^\]]+)\]/g, (_m, types) => ` ${types.replace(/,/g, ' ')}`).replace(/[()]/g, '');
      const amount = diceText(ACTOR_FORMULAS.reduce((f, [re, words]) => f.replace(re, words), formula), vars);
      return typed ? `${amount} ${typed[2].replace(/,/g, ' ')}` : amount;
    })
    .join(' and ');
}

/** "reflex|dc:23|basic" to "DC 23 basic Reflex save"; "acrobatics|dc:17" to "DC 17 Acrobatics check". */
function checkText(spec) {
  const type = spec.split('|')[0].replace(/^type:/, '');
  const dc = /\bdc:(\d+)/.exec(spec)?.[1];
  const basic = /\|basic\b/.test(spec);
  const name = capitalize(type.replace(/-/g, ' '));
  return `${dc ? `DC ${dc} ` : ''}${basic ? 'basic ' : ''}${name} ${SAVES.includes(type) ? 'save' : 'check'}`;
}

/** "emanation|distance:30" or "type:burst|distance:5" to "30-foot emanation". */
function templateText(spec) {
  const type = spec.split('|')[0].replace(/^type:/, '');
  const distance = /distance:(\d+)/.exec(spec)?.[1];
  return distance ? `${distance}-foot ${type}` : type;
}

function rollText(body, vars) {
  const [command, ...args] = body.split(/\s+/);
  const expr = args.join(' ').replace(/\s*#.*$/, '');
  if (command === 'act') return args[0].split('-').map(capitalize).join(' ');
  return damageText(expr.replace(/[{}]/g, ''), vars);
}

/** vars: the item's { level, rank }, for formulas that scale with them. */
export function cleanDescription(html = '', vars = {}) {
  let text = html
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace(/@UUID\[[^\]]*?([^.\]]+)\]/g, '$1')
    // The word after a check is usually the one checkText adds ("@Check[reflex|basic] save").
    .replace(/@Check\[([^\]]+)\](\{([^}]+)\})?( save\b| check\b)?/g, (_m, spec, _b, label, word) => (label ? `${label}${word ?? ''}` : checkText(spec)))
    .replace(/@Template\[([^\]]+)\](\{([^}]+)\})?/g, (_m, spec, _b, label) => label ?? templateText(spec));
  text = replaceNested(text, '@Damage[', (expr, label) => label ?? damageText(expr, vars));
  text = replaceNested(text, '[[/', (body, label) => label ?? rollText(body, vars));
  return text
    .replace(/\ban (DC \d)/g, 'a $1')
    .replace(/@Localize\[[^\]]+\]/g, '')
    .replace(/@\w+\[[^\]]*\](\{([^}]+)\})?/g, (_m, _b, label) => label ?? '')
    .replace(/<(\/?)([a-z0-9]+)\b[^>]*>/gi, (_m, close, tag) => (ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${close}${tag.toLowerCase()}>` : ''))
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
}
