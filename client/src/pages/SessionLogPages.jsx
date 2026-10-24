import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCampaign, useCampaignCrumbs } from './CampaignPage.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

const TITLE_MAX = 120;
const BODY_MAX = 50_000;

/** "October 24, 2026" for a "2026-10-24" date, read as written (no time zone shift). */
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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

/** The Session logs tab: the GM's write-ups, newest first. */
export function SessionLogsPage() {
  const { id } = useParams();
  const { campaign } = useCampaign();
  const [logs, setLogs] = useState(null);
  const [errors, setErrors] = useState([]);
  useCampaignCrumbs([{ label: 'Session logs' }]);

  useEffect(() => {
    api.listLogs(id).then(setLogs, (err) => setErrors(errorsFrom(err)));
  }, [id]);

  return (
    <div className="narrow logs">
      <header className="logs__head">
        <h1 className="title">Session logs</h1>
        {campaign.isGm && <Link to="new" className="btn btn--blood btn--small">New session log</Link>}
      </header>
      <FormErrors errors={errors} />
      {!logs && !errors.length && <p className="muted italic center">Gathering the chronicle…</p>}
      {logs?.length === 0 && (
        <p className="panel panel--dashed muted italic center">
          {campaign.isGm ? 'No sessions logged yet. After you play, write up what happened for your party.' : 'No sessions logged yet. Your GM writes these after each session.'}
        </p>
      )}
      {logs?.length > 0 && (
        <ul className="logs__list">
          {logs.map((log) => (
            <li key={log.id}>
              <Link to={String(log.id)} className="log-card">
                <LogMeta log={log} />
                <h2 className="log-card__title">{log.title}</h2>
                {log.excerpt && <p className="log-card__excerpt">{log.excerpt.length >= 280 ? `${log.excerpt.trimEnd()}…` : log.excerpt}</p>}
                <span className="log-card__more">Read the log</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One session log, with Edit and Delete for the GM. */
export function SessionLogPage() {
  const { id, logId } = useParams();
  const { campaign } = useCampaign();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [errors, setErrors] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useCampaignCrumbs([{ label: 'Session logs', to: `/campaigns/${id}/logs` }, { label: log ? `Session ${log.number}` : 'Session log' }]);

  useEffect(() => {
    api.getLog(id, logId).then(setLog, (err) => setErrors(errorsFrom(err)));
  }, [id, logId]);

  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteLog(id, logId);
      navigate(`/campaigns/${id}/logs`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setDeleting(false);
    }
  };

  return (
    <article className="narrow log">
      <FormErrors errors={errors} />
      {!log && !errors.length && <p className="muted italic center">Unrolling the scroll…</p>}
      {log && (
        <>
          <header className="log__head">
            <LogMeta log={log} />
            <h1 className="title">{log.title}</h1>
          </header>
          <LogBody text={log.body} />
          {campaign.isGm && (
            <footer className="log__actions">
              <Link to="edit" className="btn btn--small">Edit</Link>
              {confirming ? (
                <div className="confirm confirm--inline" role="alertdialog" aria-label="Delete session log">
                  <p>Delete “{log.title}” for everyone? This can't be undone.</p>
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
          <Link to={`/campaigns/${id}/logs`} className="log__back">← All session logs</Link>
        </>
      )}
    </article>
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
    <div className="narrow">
      <h1 className="title">{logId ? 'Edit session log' : 'New session log'}</h1>
      <FormErrors errors={errors} />
      {!form && !errors.length && <p className="muted italic center">Unrolling the scroll…</p>}
      {form && (
        <form className="panel log-form" onSubmit={save}>
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
