import { useEffect } from 'react';
import Icon from './Icon.jsx';
import { RollView } from '../pages/RollPage.jsx';

/**
 * The roller as a drawer: the last roll (a Strike, or a check rolled from the sheet),
 * sliding in from the left on wide screens and up from the bottom on phones, the mirror of
 * the details drawer. Escape closes it.
 */
export default function RollDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  return (
    <aside className={`details details--left roll-drawer ${open ? 'details--open' : ''}`} aria-label="Roll" aria-hidden={!open}>
      {open && (
        <div className="details__panel">
          <div className="details__top">
            <span className="details__kind">Roll</span>
            <button type="button" className="details__close" onClick={onClose} aria-label="Close the roll">
              <Icon name="close" size={16} />
            </button>
          </div>
          <RollView onBack={onClose} />
        </div>
      )}
    </aside>
  );
}
