// Image helpers that run in the browser. Images are decoded by waiting for an
// <img> element's load event; createImageBitmap and img.decode() don't always
// settle (headless Chrome never resolves them).

/**
 * Loads a URL or Blob/File into a decoded <img>. URLs are fetched first (a CORS
 * request for S3/CloudFront images), so the canvas can always read the result.
 */
async function loadImage(source) {
  let blob = source;
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Image ${res.status}`);
    blob = await res.blob();
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not read that image'));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Draws an image scaled to fit maxSize onto a canvas with a solid background (JPEG has no transparency). */
function drawScaled(img, maxSize, background) {
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Fetches any image (including WebP or a data URL) and re-encodes it as JPEG bytes. */
export async function imageToJpegBytes(url, maxSize = 900) {
  const canvas = drawScaled(await loadImage(url), maxSize, '#ffffff');
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.88));
  return new Uint8Array(await blob.arrayBuffer());
}
