export default function Ornament({ label }) {
  return (
    <div className="ornament" aria-hidden={label ? undefined : 'true'}>
      {label ? <span className="ornament__label">{label}</span> : <span className="ornament__gem" />}
    </div>
  );
}
