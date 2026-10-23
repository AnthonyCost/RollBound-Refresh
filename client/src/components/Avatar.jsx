/** A round profile image, falling back to the first letter of the name. */
export default function Avatar({ url, name, size = 36, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  return url ? (
    <img className={`avatar ${className}`} src={url} alt="" style={style} />
  ) : (
    <span className={`avatar avatar--letter ${className}`} style={style} aria-hidden="true">
      {(name ?? '?').trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}
