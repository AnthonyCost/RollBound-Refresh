import { useEffect, useId, useState } from 'react';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Choose a cover image by tapping or dragging. `value` is { file } for a new image,
 * { remove: true } to drop the current one, or {} to keep `currentUrl`.
 * Validates and previews locally; uploading happens when the form is saved.
 */
export default function CoverPicker({ value, currentUrl, onChange }) {
  const id = useId();
  const [filePreview, setFilePreview] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!value.file) return setFilePreview(null);
    const url = URL.createObjectURL(value.file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const shown = filePreview ?? (value.remove ? null : currentUrl);

  const accept = (f) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError('Use a JPEG, PNG, or WebP image.');
    if (f.size > MAX_BYTES) return setError('That image is over 5 MB. Try a smaller one.');
    setError(null);
    onChange({ file: f });
  };

  return (
    <div className="form-field">
      <span id={`${id}-label`}>Cover image</span>
      <div
        className={`cover-picker ${dragging ? 'cover-picker--drag' : ''} ${shown ? 'cover-picker--filled' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        {shown && <img className="cover-picker__img" src={shown} alt="Cover preview" />}
        <label htmlFor={id} className="cover-picker__label">
          <span className="eyebrow">{shown ? 'Change image' : 'Choose an image'}</span>
          <small className="muted italic">or drag one here · JPEG, PNG, or WebP up to 5 MB · wide images work best</small>
        </label>
        <input
          id={id}
          className="visually-hidden"
          type="file"
          accept={TYPES.join(',')}
          aria-labelledby={`${id}-label`}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {shown && (
        <button type="button" className="link-button" onClick={() => onChange(value.file && currentUrl ? {} : { remove: true })}>
          {value.file && currentUrl ? 'Keep the current image' : 'Remove image'}
        </button>
      )}
      {!shown && value.remove && currentUrl && (
        <button type="button" className="link-button" onClick={() => onChange({})}>Undo remove</button>
      )}
      {error && <small className="rule-note--warn" role="alert">{error}</small>}
    </div>
  );
}
