/** Whether the screen shows the two-page spread (a step then opens its current choice to start with). */
export const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

/**
 * The right-hand page of a builder book (see BookSpread): an option's name, its facts,
 * any notes, its rules text, and the buttons that choose it (children). onClose goes back
 * to the index on phones.
 */
export default function BookLeaf({ eyebrow, title, facts = [], notes, description, onClose, children }) {
  const shown = facts.filter(([, v]) => v != null && v !== '' && v !== false);
  return (
    <article className="creature book__turn">
      <button type="button" className="book__back" onClick={onClose}>‹ Back to the index</button>
      <header className="creature__head">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="title">{title}</h2>
      </header>
      {shown.length > 0 && (
        <dl className="showcase__stats">
          {shown.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {notes}
      {description && <div className="option__desc book__desc" dangerouslySetInnerHTML={{ __html: description }} />}
      <div className="book__choose">{children}</div>
    </article>
  );
}

/** "Chosen" status and a remove button, for the foot of a leaf. */
export function ChosenActions({ label, onRemove, removeLabel = 'Remove' }) {
  return (
    <>
      <span className="choice-head__status choice-head__status--done">✓ {label}</span>
      <button type="button" className="btn" onClick={onRemove}>{removeLabel}</button>
    </>
  );
}
