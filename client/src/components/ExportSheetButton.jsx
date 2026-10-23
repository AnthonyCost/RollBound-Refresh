import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useTable } from '../state/TableContext.jsx';
import { buildCharacterSheet, downloadFile, openPendingTab, showInTab, warmUpCharacterSheet } from '../sheet/exportSheet.js';

/**
 * Opens the character as a filled, still-editable Pathfinder character sheet in a
 * new tab (the browser's PDF viewer can print or save it), or downloads it.
 */
export default function ExportSheetButton() {
  const { user } = useAuth();
  const { character, portraitUrl, campaignName } = useTable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  // Load the PDF code, blank sheet, and portrait while the player reads their sheet.
  useEffect(() => {
    const warm = () => warmUpCharacterSheet({ portraitUrl });
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 1500);
    return () => clearTimeout(id);
  }, [portraitUrl]);

  const run = async (mode) => {
    // Must open synchronously in the click, before any awaits, or it's treated as a pop-up.
    const tab = mode === 'open' ? openPendingTab() : null;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const file = await buildCharacterSheet(character, { portraitUrl, playerName: user?.displayName, campaignName });
      if (tab) showInTab(tab, file);
      else {
        downloadFile(file);
        if (mode === 'open') setNote('Your browser blocked the new tab, so the sheet was downloaded instead.');
      }
    } catch (err) {
      tab?.close();
      setError(err.message || 'Could not build the PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      <button type="button" className="btn btn--grow" onClick={() => run('open')} disabled={busy}>
        {busy ? 'Building PDF…' : 'Open character sheet (PDF)'}
      </button>
      <button type="button" className="link-button export__alt" onClick={() => run('download')} disabled={busy}>
        Download instead
      </button>
      {note && <p className="rule-note" role="status">{note}</p>}
      {error && <p className="rule-note rule-note--warn" role="alert">{error}</p>}
    </div>
  );
}
