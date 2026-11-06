// Reads proficiency increases out of a class feature's rules text. Foundry's data
// encodes only a few of them as rules (Fighter Expertise, Bravery and most others are
// text only), so the importer reads sentences like "Your proficiency rank for Will
// saves increases to expert." Anything it can't read cleanly is flagged, not guessed,
// and goes in the import report for a person to check (and a correction to fix).

const RANKS = ['trained', 'expert', 'master', 'legendary'];

/**
 * The part of a feature's description that applies to one class. Shared features
 * (Weapon Expertise, Expert Spellcaster) have a paragraph per class, each starting with
 * the class names in bold: "<p><strong>Druid, Kineticist</strong> …</p>".
 */
export function sectionFor(html, className, classNames) {
  const paragraphs = String(html ?? '').split(/<\/p>/i);
  const known = new Set(classNames.map((n) => n.toLowerCase()));
  const labelled = paragraphs.map((p) => {
    const m = /^\s*<p>\s*<strong>([^<]+)<\/strong>/i.exec(p);
    const names = m ? m[1].split(/,|\band\b/).map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
    return { p, names: names.length && names.every((n) => known.has(n)) ? names : null };
  });
  if (!labelled.some((x) => x.names)) return html;
  return labelled
    .filter((x) => x.names?.includes(className.toLowerCase()))
    .map((x) => x.p)
    .join('</p>');
}

const plain = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/@\w+\[[^\]]*\](\{([^}]*)\})?/g, '$2').replace(/\s+/g, ' ').trim();

/** What a sentence's proficiency targets are, from its wording. */
function targetsOf(s) {
  const t = s.toLowerCase();
  const out = [];
  if (/\bperception\b/.test(t)) out.push('perception');
  if (/\bfortitude\b/.test(t)) out.push('fortitude');
  if (/\breflex\b/.test(t)) out.push('reflex');
  if (/\bwill save/.test(t)) out.push('will');
  // "your fighter class DC", or "your ranger DC" (but never "your spell DC").
  if (/class dc/.test(t) || /\byour (?!spell\b)[a-z]+ dc\b/.test(t)) out.push('classDc');
  if (/spell attack|spell dcs?\b|spellcasting/.test(t)) out.push('spellcasting');
  if (/unarmored defense/.test(t)) out.push('unarmored');
  if (/\barmor\b/.test(t)) {
    for (const k of ['light', 'medium', 'heavy']) if (new RegExp(`\\b${k}\\b`).test(t)) out.push(k);
    if (/\ball armor\b/.test(t)) out.push('light', 'medium', 'heavy');
  }
  if (/unarmed attacks?/.test(t)) out.push('unarmed');
  if (/\bweapons?\b/.test(t)) for (const k of ['simple', 'martial', 'advanced']) if (new RegExp(`\\b${k}\\b`).test(t)) out.push(k);
  return [...new Set(out)];
}

/**
 * Proficiency increases a feature gives one class: { increases: [{ target, rank }],
 * flags: [text] }. A flag is a sentence that talks about a proficiency rank but
 * couldn't be read with confidence (limited to a weapon group, several ranks at once,
 * or no recognizable target), for the report.
 */
export function proficiencyIncreases(html, className, classNames) {
  const text = plain(sectionFor(html, className, classNames));
  const increases = [];
  const flags = [];
  // "…increase to legendary, and your proficiency rank for advanced weapons increases to
  // master" is two increases: read each clause on its own.
  const clauses = text.split(/(?<=\.)\s+/).flatMap((s) => s.split(/,? and (?=your proficiency rank)/i));
  for (const sentence of clauses) {
    if (!/proficiency rank/i.test(sentence) && !/gain (trained|expert|master|legendary) proficiency/i.test(sentence)) continue;
    const ranks = [...sentence.toLowerCase().matchAll(/\b(trained|expert|master|legendary)\b/g)].map((m) => m[1]);
    const targets = targetsOf(sentence);
    const limited = /\bin that group\b|\bwith the\b.*\bin\b|\bof your choice\b|\bchosen\b|\bthe (weapon|weapons) (you|your)/i.test(sentence);
    const distinct = [...new Set(ranks)];
    if (!targets.length || distinct.length !== 1 || limited) {
      flags.push(sentence);
      continue;
    }
    for (const target of targets) increases.push({ target, rank: distinct[0] });
  }
  return { increases, flags };
}

export const rankIndex = (rank) => RANKS.indexOf(rank);
