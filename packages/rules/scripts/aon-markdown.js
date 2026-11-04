// Archives of Nethys markdown to HTML, shared by the bestiary and armory imports: links
// become plain text, **bold** and _italic_ become tags, action glyphs become icons, and
// runs of lines become paragraphs, lists, tables and rules.
export const unlink = (s = '') => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
const ACTION_ICONS = { 'Single Action': ['1', 'one action'], 'Two Actions': ['2', 'two actions'], 'Three Actions': ['3', 'three actions'], Reaction: ['r', 'reaction'], 'Free Action': ['f', 'free action'] };

export const esc = (s) => s.replace(/&(?!(?:[a-z]+|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markdown: links become plain text, **bold** and _italic_ become tags, action glyphs become icons. */
export function inline(text) {
  return esc(unlink(text))
    .replace(/&lt;actions string="([^"]+)"\s*\/&gt;/g, (_m, a) => {
      const [k, label] = ACTION_ICONS[a] ?? ['', a];
      return `<span class="act act--${k}" role="img" aria-label="${label}"></span>`;
    })
    // A few entries list options inline as raw HTML (a cassisian's Change Shape forms): keep those lists as lists.
    .replace(/&lt;(\/?)(ul|ol|li)&gt;/g, '<$1$2>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/ {2,}/g, ' ')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s),.;:]|$)/g, '$1<em>$2</em>');
}

/**
 * Turns a run of stat block markdown into paragraphs, lists and rules. Lines that
 * continue a list item (a spell rank's spells) or a labelled field (Languages, then
 * the languages) are joined to it.
 */
export function blocks(md) {
  const out = [];
  const paragraphs = md
    .replace(/<\/?(row|column|traits|trait|document|br|center)[^>]*\/?>/g, '\n')
    .replace(/<table>[\s\S]*?<\/table>/g, (t) => `\n${t.replace(/\n/g, ' ')}\n`)
    // "**Melee** ◆ jaws +21 (reach 10 feet)," and its "**Damage** 2d12+9 piercing" are one line.
    .replace(/,\n\*\*Damage\*\*/g, ' **Damage**')
    .split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const text = raw.trim();
    if (!text) continue;
    if (/^---+$/.test(text)) {
      out.push('<hr>');
      continue;
    }
    if (text.startsWith('<table>')) {
      out.push(text.replace(/<(\/?)(table|tr|td|th)[^>]*>/g, '<$1$2>').replace(/>([^<]+)</g, (_m, t) => `>${inline(t)}<`));
      continue;
    }
    const lines = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      // A Strike's **Damage** stays on its attack's line, as in the book.
      const starts = /^[-*] /.test(line) || (/^\*\*[^*]+\*\*/.test(line) && !/^\*\*Damage\*\*/.test(line));
      if (/^---+$/.test(line)) lines.push('---');
      else if (starts || !lines.length) lines.push(line);
      else lines[lines.length - 1] += ` ${line}`;
    }
    let list = [];
    const flush = () => {
      if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`);
      list = [];
    };
    for (const line of lines) {
      if (line === '---') {
        flush();
        out.push('<hr>');
      } else if (/^[-*] /.test(line)) list.push(line.slice(2));
      else {
        flush();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    flush();
  }
  // A few AoN entries have unbalanced bold markers or a link the parser missed; tidy those last.
  return out
    .join('')
    .replace(/\[([^\]]*)\]\(\/[^)]*\)/g, '$1')
    .replace(/\*\*/g, '');
}
