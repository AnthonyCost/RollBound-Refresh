// Using a consumable in combat (a potion, an elixir): how many actions activating it costs and,
// for healing items, how many Hit Points it restores, read from its armory rules text (HTML).

const ACT = { 1: '1', 2: '2', 3: '3', r: 'reaction', f: 'free' };
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * How an item is used: { cost, heal, text }. cost is '1', '2', '3', 'reaction' or 'free' (null
 * when it has no Activate entry); heal is dice like '2d8+5' or null; text is the effect, in
 * plain words. name picks the grade of an item that has several (Healing Potion (Lesser)).
 */
export function consumableUse(html, name = null) {
  if (!html) return { cost: null, heal: null, text: '' };
  const act = /<strong>Activate<\/strong>\s*<span class="act act--([123rf])"/.exec(html);
  // The grade's own section, if the item has grades: from its heading to the next one.
  const sections = html.split(/<h3 class="item-variant">/);
  const own = name && sections.slice(1).find((s) => strip(s.split('<span')[0]).toLowerCase() === name.toLowerCase());
  const body = sections[0].replace(/<p><strong>Activate<\/strong>.*?<\/p>/, '');
  const scope = own ?? html;
  const heal = /(?:restores?|regain|regains)\s+(\d+d\d+(?:\s*[+−-]\s*\d+)?)\s+Hit Points/i.exec(strip(scope));
  return {
    cost: act ? ACT[act[1]] : null,
    heal: heal ? heal[1].replace(/\s+/g, '').replace('−', '-') : null,
    text: strip([body, own ? own.replace(/^.*?<\/h3>/, '').replace(/<p><strong>Price<\/strong>.*?<\/p>/, '') : ''].join(' ')),
  };
}
