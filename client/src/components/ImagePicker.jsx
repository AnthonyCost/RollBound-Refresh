import { useEffect, useId, useState } from 'react';
import ImageCropper from './ImageCropper.jsx';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// A chosen image is cropped to its shape and saved at this size before it's uploaded.
const CROPS = {
  // Campaign covers, in the campaign page banner's 5:2 shape.
  wide: { width: 1600, height: 640, title: 'Crop the cover' },
  square: { width: 800, height: 800, title: 'Crop the portrait' },
  avatar: { width: 512, height: 512, round: true, title: 'Crop your profile picture' },
};
// The biggest photo we'll open to crop (the cropped file is far smaller, within maxMb).
const MAX_SOURCE_MB = 25;

/**
 * Choose an image by tapping or dragging. `value` is { file } for a new image,
 * { remove: true } to drop the current one, or {} to keep `currentUrl`.
 * A chosen image opens in a cropper fixed to the shape (CROPS); the cropped file is what's
 * previewed and later uploaded, when the form is saved.
 * shape is "wide" (5:2 campaign covers), "square" (portraits) or "avatar" (a small round picture
 * with its text beside it, for profile pictures). compact keeps only a short call to action
 * inside the frame (the file rules move to a tooltip), for tight spots like a page header.
 */
export default function ImagePicker({ label, value, currentUrl, onChange, shape = 'wide', maxMb = 5, hint, compact = false }) {
  const id = useId();
  const [filePreview, setFilePreview] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [cropping, setCropping] = useState(null);

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
    if (f.size > MAX_SOURCE_MB * 1024 * 1024) return setError(`That image is over ${MAX_SOURCE_MB} MB. Try a smaller one.`);
    setError(null);
    setCropping(f);
  };
  const cropped = (f) => {
    setCropping(null);
    if (f.size > maxMb * 1024 * 1024) return setError(`That crop came out over ${maxMb} MB. Try another image.`);
    onChange({ file: f });
  };

  return (
    <div className={`form-field ${compact ? 'form-field--compact' : ''}`}>
      <span id={`${id}-label`}>{label}</span>
      <div
        className={`image-picker image-picker--${shape} ${compact ? 'image-picker--compact' : ''} ${dragging ? 'image-picker--drag' : ''} ${shown ? 'image-picker--filled' : ''}`}
        title={compact ? `Tap or drag an image here · JPEG, PNG, or WebP; you'll crop it to fit${hint ? ` · ${hint}` : ''}` : undefined}
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
        {shown && <img className="image-picker__img" src={shown} alt={`${label} preview`} />}
        <label htmlFor={id} className="image-picker__label">
          <span className="eyebrow">{shown ? 'Change' : compact ? 'Add portrait' : 'Choose an image'}</span>
          {!compact && (
            <small className="muted italic">
              or drag one here · JPEG, PNG, or WebP; you'll crop it to fit{hint ? ` · ${hint}` : ''}
            </small>
          )}
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
      {cropping && <ImageCropper file={cropping} {...CROPS[shape]} onDone={cropped} onCancel={() => setCropping(null)} />}
    </div>
  );
}
