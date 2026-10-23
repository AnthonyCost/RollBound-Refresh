// Builds a filled Pathfinder character sheet and opens or downloads it. pdf-lib
// and the fill logic load only when someone exports, so they don't slow the app.
import { imageToJpegBytes } from '../imageData.js';

export const SHEET_TEMPLATE_URL = '/sheets/pf2e-remaster-character-sheet.pdf';

export const sheetFileName = (name) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character'}-character-sheet.pdf`;

// Cached so the first click doesn't wait on downloads (see warmUpCharacterSheet).
let templatePromise = null;
let modulePromise = null;
const portraitCache = new Map();

function loadTemplate() {
  templatePromise ??= fetch(SHEET_TEMPLATE_URL).then(async (res) => {
    if (!res.ok || !res.headers.get('content-type')?.includes('pdf')) {
      throw new Error("The character sheet template isn't installed on this server yet. See docs/character-sheet-pdf.md.");
    }
    return res.arrayBuffer();
  });
  // Let a failure (e.g. offline) be retried on the next attempt.
  templatePromise.catch(() => (templatePromise = null));
  return templatePromise;
}

function loadFillModule() {
  modulePromise ??= import('./characterSheetPdf.js');
  modulePromise.catch(() => (modulePromise = null));
  return modulePromise;
}

/** A portrait that can't load (e.g. blocked by CORS) just leaves the sketch box empty. */
function loadPortrait(url) {
  if (!url) return Promise.resolve(null);
  if (!portraitCache.has(url)) {
    portraitCache.set(url, imageToJpegBytes(url).then((bytes) => ({ bytes, type: 'jpg' }), () => null));
  }
  return portraitCache.get(url);
}

/** Starts fetching the PDF code, template, and portrait so exporting is quick later. */
export function warmUpCharacterSheet({ portraitUrl } = {}) {
  loadFillModule().catch(() => {});
  loadTemplate().catch(() => {});
  loadPortrait(portraitUrl);
}

/** Returns the filled sheet as a PDF File. */
export async function buildCharacterSheet(character, { portraitUrl, playerName, campaignName } = {}) {
  const [{ fillCharacterSheet }, templateBytes, portrait] = await Promise.all([loadFillModule(), loadTemplate(), loadPortrait(portraitUrl)]);
  // pdf-lib takes ownership of the bytes it loads, so give it a copy of the cached template.
  const bytes = await fillCharacterSheet(templateBytes.slice(0), character, { playerName, campaignName, portrait });
  return new File([bytes], sheetFileName(character.name), { type: 'application/pdf' });
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Opens a tab right away (browsers block pop-ups opened after async work) and
 * shows a placeholder until the PDF is ready. Returns null if pop-ups are blocked.
 */
export function openPendingTab() {
  const tab = window.open('', '_blank');
  if (!tab) return null;
  tab.document.title = 'Building your character sheet…';
  tab.document.body.style.cssText = 'margin:0;display:grid;place-items:center;height:100vh;background:#0b0908;color:#cdbea2;font:18px Georgia,serif';
  tab.document.body.textContent = 'Building your character sheet…';
  return tab;
}

/** Shows the PDF in the browser's built-in viewer, where it can be printed or saved. */
export function showInTab(tab, file) {
  const url = URL.createObjectURL(file);
  tab.location.href = url;
  // Keep the URL alive long enough for the viewer to load (and for a quick reload).
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}
