import { useLocation } from 'react-router-dom';
import { useTable } from '../state/TableContext.jsx';
import { bannerFor, classSlugOf } from '../builder/art.js';

/**
 * The character's class banner behind the Sheet tab: full width under the tabs, at
 * the banner's own shape, fading to black below it. Nothing when the class has no
 * banner, or on the other tabs.
 */
export default function SheetBackdrop() {
  const { character } = useTable();
  const { pathname } = useLocation();
  const url = bannerFor(classSlugOf(character));
  if (!url || !pathname.endsWith('/sheet')) return null;
  return (
    <div className="sheet-backdrop" aria-hidden="true">
      <img src={url} alt="" />
    </div>
  );
}
