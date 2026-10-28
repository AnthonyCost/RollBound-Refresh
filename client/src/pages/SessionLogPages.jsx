import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import BookSpread from '../components/BookSpread.jsx';

const TITLE_MAX = 120;
const BODY_MAX = 50_000;

/** "October 24, 2026" for a "2026-10-24" date, read as written (no time zone shift). */
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
/** "Oct 24, 2026", for the journal's index. */
const shortDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** The log's text as paragraphs: a blank line starts a new one, single line breaks stay. */
function LogBody({ text }) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  if (!paragraphs.length) return <p className="muted italic">This log is empty.</p>;
  return (
    <div className="log-body">
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

function LogMeta({ log }) {
  return (
    <p className="log-meta">
      <span className="eyebrow">Session {log.number}</span>
      {log.playedOn && <span> · Played {longDate(log.playedOn)}</span>}
    </p>
  );
}

// Sessions are grouped ten to a tab: 1–10, 11–20, and so on.
const decadeOf = (log) => String(Math.floor((log.number - 1) / 10));
const decadeName = (key) => `Sessions ${Number(key) * 10 + 1}–${Number(key) * 10 + 10}`;

/**
 * The Session logs tab, as the campaign's journal: the sessions in the order they were
 * played on the left page, and the open log on the right (at /logs/:logId). On phones
 * it's one page at a time.
 */
export function SessionLogsPage() {
  const { id, logId } = useParams();
  const { campaign } = useCampaign();
  const navigate = useNavigate();
  const [logs, setLogs] = useState(null);
  const [log, setLog] = useState(null);
  const [errors, setErrors] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useCampaignCrumbs(logId ? [{ label: 'Session logs', to: `/campaigns/${id}/logs` }, { label: log ? `Session ${log.number}` : 'Session log' }] : [{ label: 'Session logs' }]);

  useEffect(() => {
    api.listLogs(id).then(setLogs, (err) => setErrors(errorsFrom(err)));
  }, [id]);
  useEffect(() => {
    setLog(null);
    setConfirming(false);
    if (logId) api.getLog(id, logId).then(setLog, (err) => setErrors(errorsFrom(err)));
  }, [id, logId]);

  // The index shows each log's title (the book reads `name`), led by its session number.
  const ordered = logs ? [...logs].sort((a, b) => a.number - b.number).map((l) => ({ ...l, name: l.title })) : [];
  const decades = [...new Set(ordered.map(decadeOf))].map((key) => ({ key, tab: `${Number(key) * 10 + 1}–${Number(key) * 10 + 10}`, name: decadeName(key) }));
  const open = logId ? ordered.find((l) => String(l.id) === String(logId)) ?? null : null;
  const at = open ? ordered.indexOf(open) : -1;
  const prev = at > 0 ? ordered[at - 1] : null;
  const next = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : null;
  const toLog = (l) => `/campaigns/${id}/logs/${l.id}`;

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteLog(id, logId);
      setLogs((list) => list.filter((l) => String(l.id) !== String(logId)));
      setDeleting(false);
      navigate(`/campaigns/${id}/logs`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setDeleting(false);
    }
  };

  return (
    <div className="feats-tab logs">
      <header className="logs__head">
        <div>
          <h1 className="sheet-panel__title">Session logs</h1>
          <p className="rule-note" style={{ margin: 0 }}>The story so far, as {campaign.isGm ? 'you wrote it' : 'your GM wrote it'} after each session.</p>
        </div>
        {campaign.isGm && <Link to={`/campaigns/${id}/logs/new`} className="btn btn--blood btn--small">New session log</Link>}
      </header>
      <FormErrors errors={errors} />
      {!logs && !errors.length && <p className="muted italic center">Gathering the chronicle…</p>}
      {logs?.length === 0 && (
        <p className="panel panel--dashed muted italic center">
          {campaign.isGm ? 'No sessions logged yet. After you play, write up what happened for your party.' : 'No sessions logged yet. Your GM writes these after each session.'}
        </p>
      )}
      {logs?.length > 0 && (
        <BookSpread
          items={ordered}
          total={ordered.length}
          noun="sessions"
          sections={decades}
          sectionOf={decadeOf}
          tabsOnTop
          open={open}
          href={toLog}
          lead={(l) => (
            <>
              <span className="visually-hidden">Session </span>
              {l.number}
            </>
          )}
          meta={(l) => <span className="muted">{l.playedOn ? shortDate(l.playedOn) : 'No date'}</span>}
          emptyText="No sessions yet."
          leaf={open && (
            <article className="creature book__turn log">
              <Link to={`/campaigns/${id}/logs`} className="book__back">‹ Back to the journal</Link>
              <header className="log__head">
                <LogMeta log={open} />
                <h2 className="title">{open.title}</h2>
              </header>
              {log ? <LogBody text={log.body} /> : <p className="muted italic">Unrolling the scroll…</p>}
              <nav className="log__turn" aria-label="Other sessions">
                {prev ? <Link to={toLog(prev)}>‹ Session {prev.number}</Link> : <span />}
                {next ? <Link to={toLog(next)}>Session {next.number} ›</Link> : <span />}
              </nav>
              {campaign.isGm && (
                <footer className="book__choose log__actions">
                  <Link to={`/campaigns/${id}/logs/${open.id}/edit`} className="btn btn--small">Edit</Link>
                  {confirming ? (
                    <div className="confirm confirm--inline" role="alertdialog" aria-label="Delete session log">
                      <p>Delete “{open.title}” for everyone? This can't be undone.</p>
                      <div className="btn-row">
                        <button type="button" className="btn btn--grow" onClick={() => setConfirming(false)}>Keep it</button>
                        <button type="button" className="btn btn--blood btn--grow" disabled={deleting} onClick={remove}>
                          {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn--small" onClick={() => setConfirming(true)}>Delete</button>
                  )}
                </footer>
              )}
            </article>
          )}
          blank={
            <>
              <p className="book__blank-title">The campaign journal</p>
              <p className="rule-note">Open a session from the index to read what happened. The newest is at the end.</p>
            </>
          }
        />
      )}
    </div>
  );
}

/** Writing a new session log, or editing one (with :logId). GM only. */
export function SessionLogEditor() {
  const { id, logId } = useParams();
  const { campaign } = useCampaign();
  const navigate = useNavigate();
  const [form, setForm] = useState(logId ? null : { title: '', playedOn: today(), body: '' });
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  // Preview shows the log as the party will read it.
  const [previewing, setPreviewing] = useState(false);
  useCampaignCrumbs([
    { label: 'Session logs', to: `/campaigns/${id}/logs` },
    ...(logId ? [{ label: 'Edit' }] : [{ label: 'New' }]),
  ]);

  useEffect(() => {
    if (!logId) return;
    api.getLog(id, logId).then((log) => setForm({ title: log.title, playedOn: log.playedOn ?? '', body: log.body }), (err) => setErrors(errorsFrom(err)));
  }, [id, logId]);

  if (!campaign.isGm) return <p className="rule-note center">Only the GM writes session logs.</p>;

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors([]);
    try {
      const body = { title: form.title, playedOn: form.playedOn || null, body: form.body };
      const saved = logId ? await api.updateLog(id, logId, body) : await api.createLog(id, body);
      navigate(`/campaigns/${id}/logs/${saved.id}`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setSaving(false);
    }
  };

  return (
    <div className="log-editor">
      <header className="logs__head">
        <h1 className="sheet-panel__title">{logId ? 'Edit session log' : 'New session log'}</h1>
        {form && (
          <div className="log-editor__modes" role="group" aria-label="Write or preview">
            <button type="button" className="chip" aria-pressed={!previewing} onClick={() => setPreviewing(false)}>Write</button>
            <button type="button" className="chip" aria-pressed={previewing} onClick={() => setPreviewing(true)}>Preview</button>
          </div>
        )}
      </header>
      <FormErrors errors={errors} />
      {!form && !errors.length && <p className="muted italic center">Unrolling the scroll…</p>}
      {form && previewing && (
        <article className="book__page log log-editor__preview">
          <header className="log__head">
            <p className="log-meta">
              <span className="eyebrow">Preview</span>
              {form.playedOn && <span> · Played {longDate(form.playedOn)}</span>}
            </p>
            <h2 className="title">{form.title || 'Untitled session'}</h2>
          </header>
          <LogBody text={form.body} />
          <div className="btn-row log-editor__preview-actions">
            <button type="button" className="btn btn--grow" onClick={() => setPreviewing(false)}>Keep writing</button>
            <button type="submit" form="log-form" className="btn btn--blood btn--grow" disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : logId ? 'Save changes' : 'Publish log'}
            </button>
          </div>
        </article>
      )}
      {form && (
        <form id="log-form" className="book__page log-form" hidden={previewing} onSubmit={save}>
          <label className="form-field">
            <span>Title</span>
            <input value={form.title} maxLength={TITLE_MAX} required placeholder="The wolves were soldiers after all" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="form-field">
            <span>Played on</span>
            <input type="date" value={form.playedOn} onChange={(e) => setForm({ ...form, playedOn: e.target.value })} />
            <small className="muted">Logs are numbered in the order they were played.</small>
          </label>
          <label className="form-field">
            <span>What happened</span>
            <textarea
              className="log-form__body"
              rows={16}
              maxLength={BODY_MAX}
              value={form.body}
              placeholder={'Recap the session for your party.\n\nLeave a blank line between paragraphs.'}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <small className="muted">{form.body.length.toLocaleString('en-US')} / {BODY_MAX.toLocaleString('en-US')}</small>
          </label>
          <div className="btn-row">
            <Link to={logId ? `/campaigns/${id}/logs/${logId}` : `/campaigns/${id}/logs`} className="btn btn--grow">Cancel</Link>
            <button type="submit" className="btn btn--blood btn--grow" disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : logId ? 'Save changes' : 'Publish log'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
