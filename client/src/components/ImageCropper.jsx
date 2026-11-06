import { useEffect, useRef, useState } from 'react';

const MAX_ZOOM = 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Crop an image to a fixed shape before it's uploaded: drag to move it, zoom with the slider,
 * the mouse wheel or + and −, arrow keys to nudge. The image always fills the frame. Done hands
 * onDone a new File of exactly width × height (WebP, or PNG where the browser can't write WebP).
 * round only changes the preview (a profile picture shows as a circle; the file stays square).
 */
export default function ImageCropper({ file, width, height, round = false, title, onDone, onCancel }) {
  const dialog = useRef(null);
  const frame = useRef(null);
  const [img, setImg] = useState(null);
  const [failed, setFailed] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    // A load that's been cleaned up (a new file, or React's double run in development) is ignored.
    let live = true;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => live && setImg(image);
    image.onerror = () => live && setFailed(true);
    image.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // The frame's size on screen, kept current as the window changes.
  useEffect(() => {
    const measure = () => {
      const r = frame.current?.getBoundingClientRect();
      if (r) setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame.current);
    return () => ro.disconnect();
  }, []);

  // At zoom 1 the image just covers the frame; the offset can't pull an edge into view.
  const scale = img && box.w ? Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * zoom : 0;
  const shownW = img ? img.naturalWidth * scale : 0;
  const shownH = img ? img.naturalHeight * scale : 0;
  const fit = (o, s = scale) => {
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    return { x: clamp(o.x, -(w - box.w) / 2, (w - box.w) / 2), y: clamp(o.y, -(h - box.h) / 2, (h - box.h) / 2) };
  };
  const zoomTo = (z) => {
    const next = clamp(z, 1, MAX_ZOOM);
    setZoom(next);
    // Keep the same spot in the middle of the frame as it zooms.
    setOff((o) => fit({ x: (o.x * next) / zoom, y: (o.y * next) / zoom }, (scale / zoom) * next));
  };
  const nudge = (dx, dy) => setOff((o) => fit({ x: o.x + dx, y: o.y + dy }));

  const done = async () => {
    setBusy(true);
    // The frame's area, in the image's own pixels.
    const left = box.w / 2 - shownW / 2 + off.x;
    const top = box.h / 2 - shownH / 2 + off.y;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -left / scale, -top / scale, box.w / scale, box.h / scale, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob) {
      setBusy(false);
      return setFailed(true);
    }
    const ext = blob.type === 'image/webp' ? 'webp' : 'png';
    onDone(new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`, { type: blob.type }));
  };

  return (
    <dialog ref={dialog} className="cropper" aria-labelledby="cropper-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2 id="cropper-title" className="panel__title">{title}</h2>
      <p className="rule-note" style={{ margin: 0 }}>Drag to position it, and zoom to fit what you want to show.</p>
      {/* The stage shows the whole image around the crop, dimmed, so you can see what's just outside it.
          The frame (dashed) is the crop itself; drag anywhere on the stage to move the image. */}
      <div
        className="cropper__stage"
        tabIndex={0}
        role="application"
        aria-label="Image position. Use the arrow keys to move it, and + or − to zoom."
        onPointerDown={(e) => {
          if (!img) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          drag.current = { x: e.clientX, y: e.clientY };
          nudge(dx, dy);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onWheel={(e) => img && zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10;
          const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
          if (moves[e.key]) { e.preventDefault(); nudge(...moves[e.key]); }
          if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.1);
          if (e.key === '-' || e.key === '_') zoomTo(zoom / 1.1);
        }}
      >
        {/* The whole image, dimmed; the frame below shows the crop at full brightness. Both sit centered on
            the frame (the stage pads it evenly), so the two copies line up exactly. */}
        {img && (
          <img
            className="cropper__img cropper__img--outside"
            src={img.src}
            alt=""
            draggable={false}
            style={{ width: shownW, height: shownH, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
          />
        )}
        <div
          ref={frame}
          className={`cropper__frame ${round ? 'cropper__frame--round' : ''}`}
          // Sized by width only, so it always keeps the file's shape (the crop maps the frame onto the file).
          style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(48dvh * ${width / height})${round ? ', 380px' : ''})` }}
        >
          {img && (
            <img
              className="cropper__img"
              src={img.src}
              alt=""
              draggable={false}
              style={{ width: shownW, height: shownH, transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))` }}
            />
          )}
          {!img && !failed && <p className="muted italic center cropper__status">Opening the image…</p>}
          {failed && <p className="rule-note--warn center cropper__status" role="alert">Couldn't read that image. Try another one.</p>}
        </div>
      </div>
      <label className="cropper__zoom">
        <span>Zoom</span>
        <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom} disabled={!img} onChange={(e) => zoomTo(Number(e.target.value))} />
      </label>
      <div className="btn-row">
        <button type="button" className="btn btn--grow" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn--blood btn--grow" disabled={!img || busy} onClick={done}>{busy ? 'Cropping…' : 'Use this crop'}</button>
      </div>
    </dialog>
  );
}
