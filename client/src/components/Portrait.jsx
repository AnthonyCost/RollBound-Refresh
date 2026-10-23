/** A character's portrait in an ornate frame, or their initial when there's none. */
export default function Portrait({ url, name, size = 'md' }) {
  return (
    <span className={`portrait portrait--${size}`} aria-hidden="true">
      {url ? <img src={url} alt="" /> : <span className="portrait__letter">{name?.trim()[0] ?? '?'}</span>}
    </span>
  );
}
