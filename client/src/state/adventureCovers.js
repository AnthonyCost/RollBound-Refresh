// Covers for Adventure Paths, from client/src/assets/adventure-paths/<slug>.webp
// (local only: see the README there). Paths without one have no cover.
const FILES = import.meta.glob('../assets/adventure-paths/*.webp', { eager: true, query: '?url', import: 'default' });

const COVERS = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]));

/** The cover's URL for an Adventure Path slug, or null. */
export const adventureCover = (slug) => COVERS[slug] ?? null;

/** The cover as a File, ready to upload like one the GM chose; null without one. */
export async function adventureCoverFile(slug) {
  const url = adventureCover(slug);
  if (!url) return null;
  const blob = await (await fetch(url)).blob();
  return new File([blob], `${slug}.webp`, { type: blob.type || 'image/webp' });
}
