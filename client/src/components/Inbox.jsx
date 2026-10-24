import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { inboxChanged, onInboxChanged } from '../state/inbox.js';
import FormErrors, { errorsFrom } from './FormErrors.jsx';
import Portrait from './Portrait.jsx';

const POLL_MS = 60_000;
const KIND_LABEL = {
  announcement: 'Announcement',
  'patch-notes': 'Patch notes',
  'join-request': 'Join request',
  'join-accepted': 'Accepted',
  'join-rejected': 'Declined',
};
const STATUS_LABEL = { accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn: they asked to join another campaign' };

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The inbox button in the top bar, with the unread count, and its panel:
 * announcements, patch notes, and join requests for your campaigns to accept or reject.
 */
export default function Inbox() {
  const { status } = useAuth();
  const [inbox, setInbox] = useState(null);
  const [open, setOpen] = useState(false);
  const panel = useRef(null);
  const button = useRef(null);

  const load = useCallback(() => {
    api.inbox().then(setInbox, () => {});
  }, []);

  // Load now, every minute, when the tab comes back into view, and when something changes.
  useEffect(() => {
    if (status !== 'user') return undefined;
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    const off = onInboxChanged(load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
      off();
    };
  }, [load, status]);

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && (setOpen(false), button.current?.focus());
    const onClick = (e) => !panel.current?.contains(e.target) && !button.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  // Opening the inbox reads what's in it.
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next || !inbox?.unread) return;
    const ids = inbox.messages.filter((m) => !m.read).map((m) => m.id);
    api.markRead(ids).then(() => setInbox((x) => x && { ...x, unread: 0 }), () => {});
  };

  if (!inbox) return null;
  const unread = inbox.unread;
  return (
    <div className="inbox">
      <button
        ref={button}
        type="button"
        className="inbox__button"
        aria-expanded={open}
        aria-controls="inbox-panel"
        aria-label={unread ? `Inbox, ${unread} unread` : 'Inbox'}
        onClick={toggle}
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13l3-8h12l3 8v6H3z" />
          <path d="M3 13h5l1 2h6l1-2h5" />
        </svg>
        {unread > 0 && <span className="inbox__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <section ref={panel} id="inbox-panel" className="inbox__panel" aria-label="Inbox">
          <h2 className="panel__title">Inbox</h2>
          {inbox.messages.length ? (
            <ul className="inbox__list">
              {inbox.messages.map((m) => (
                <Message key={m.id} message={m} wasUnread={!m.read} onAnswered={load} onNavigate={() => setOpen(false)} />
              ))}
            </ul>
          ) : (
            <p className="muted italic center">Nothing here yet.</p>
          )}
        </section>
      )}
    </div>
  );
}

function Message({ message: m, wasUnread, onAnswered, onNavigate }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const request = m.request;
  const pending = m.kind === 'join-request' && request?.status === 'pending';

  const answer = async (accept) => {
    setBusy(true);
    setErrors([]);
    try {
      await api.answerJoinRequest(request.id, accept);
      inboxChanged();
      onAnswered();
    } catch (err) {
      setErrors(errorsFrom(err));
      // Someone else may have answered (it's no longer pending): show the current state.
      onAnswered();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`inbox__item inbox__item--${m.kind} ${wasUnread ? 'inbox__item--unread' : ''} ${pending ? 'inbox__item--action' : ''}`}>
      <div className="inbox__meta">
        <span className={`tag inbox__kind inbox__kind--${m.kind}`}>{KIND_LABEL[m.kind] ?? m.kind}</span>
        <span className="muted">{when(m.createdAt)}</span>
      </div>
      <p className="inbox__title">{m.title}</p>
      {request?.character && (
        <div className="inbox__who">
          <Portrait url={request.character.portraitUrl} name={request.character.name} size="sm" />
          <span>
            <strong>{request.character.name}</strong>
            <span className="muted"> · Level {request.character.level} {[request.character.ancestry, request.character.className].filter(Boolean).join(' ')}</span>
            <br />
            <span className="muted">Played by {request.character.player}</span>
          </span>
        </div>
      )}
      {m.body && <p className="inbox__body">{m.body}</p>}
      {pending && (
        <div className="btn-row">
          <button type="button" className="btn btn--grow" disabled={busy} onClick={() => answer(false)}>Reject</button>
          <button type="button" className="btn btn--blood btn--grow" disabled={busy} onClick={() => answer(true)}>Accept</button>
        </div>
      )}
      {m.kind === 'join-request' && !pending && request?.status && <p className="inbox__status">{STATUS_LABEL[request.status] ?? request.status}</p>}
      {(m.kind === 'join-accepted' || (m.kind === 'join-request' && request?.status === 'accepted')) && (
        <Link to={`/campaigns/${request.campaign.id}`} className="inbox__link" onClick={onNavigate}>Open {request.campaign.name}</Link>
      )}
      <FormErrors errors={errors} />
    </li>
  );
}
