// Pathfinder's action symbols (styled as .act in theme.css): one, two or three actions,
// a reaction or a free action. Rules text from the data already uses the same spans.
const ICONS = { 1: '1', 2: '2', 3: '3', reaction: 'r', free: 'f' };
const LABELS = { 1: 'one action', 2: 'two actions', 3: 'three actions', reaction: 'reaction', free: 'free action' };

const Glyph = ({ kind }) => <span className={`act act--${ICONS[kind]}`} role="img" aria-label={LABELS[kind]} />;

// Older saved characters spell costs out ("single action to three actions").
const WORDS = [[/\b(single|one) actions?\b/g, '1'], [/\btwo actions\b/g, '2'], [/\bthree actions\b/g, '3'], [/\bfree action\b/g, 'free']];

/** An action cost as its symbol, "1 to 3" as two symbols, or the words ("1 minute") when it has none. */
export default function ActionCost({ actions }) {
  const key = WORDS.reduce((k, [word, value]) => k.replace(word, value), String(actions ?? '').trim().toLowerCase());
  if (ICONS[key]) return <Glyph kind={key} />;
  const range = /^(\d|reaction|free) to (\d|reaction|free)$/.exec(key);
  if (range) {
    return (
      <span className="cast-range">
        <Glyph kind={range[1]} /> to <Glyph kind={range[2]} />
      </span>
    );
  }
  return <span>{actions}</span>;
}
