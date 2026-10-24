import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * A button that opens a dropdown list, like GitHub's header menus. items are
 * { label, to } links, { label, onClick } actions, or 'divider'. header is shown
 * above them. Escape, a click outside, or choosing an item closes it; arrow keys
 * move between items.
 */
export default function Menu({ label, button, header, items, className = '' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    list.current?.querySelector('[role="menuitem"]')?.focus();
    const onClick = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [...(list.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    const i = all.indexOf(document.activeElement);
    all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus();
  };

  const close = () => setOpen(false);
  return (
    <div ref={wrap} className={`menu ${className}`} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className="menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {button}
      </button>
      {open && (
        <div ref={list} id={id} className="menu__list" role="menu" aria-label={label}>
          {header && <div className="menu__header">{header}</div>}
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} className="menu__divider" role="separator" />
            ) : item.to ? (
              <Link key={item.label} to={item.to} role="menuitem" className="menu__item" onClick={close}>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  close();
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
