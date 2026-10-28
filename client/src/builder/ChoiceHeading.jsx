/**
 * A builder choice's heading, with its status in words (not only color): what's
 * chosen, or what's still needed. `chosen` is the picked option's name, or empty.
 */
export default function ChoiceHeading({ title, chosen, need = 'Choose one', level = 2 }) {
  const Tag = `h${level}`;
  return (
    <div className="choice-head">
      <Tag className="choice-head__title">{title}</Tag>
      <span className={`choice-head__status ${chosen ? 'choice-head__status--done' : ''}`}>
        {chosen ? (
          <>
            <span aria-hidden="true">✓ </span>
            <span className="visually-hidden">Chosen: </span>
            {chosen}
          </>
        ) : (
          need
        )}
      </span>
    </div>
  );
}
