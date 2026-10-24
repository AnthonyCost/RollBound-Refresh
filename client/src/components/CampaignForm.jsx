import { useEffect, useState } from 'react';
import ImagePicker from './ImagePicker.jsx';
import CampaignCover from './CampaignCover.jsx';
import FormErrors, { errorsFrom } from './FormErrors.jsx';
import { CORE_BOOK, campaignBooks } from '@rollbound/rules';
import { ALL_BOOKS, booksLabel } from '../state/rulesData.js';

const NAME_MAX = 80;
const BACKSTORY_MAX = 5000;
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * Which books players can build from. "Every book" (null) also covers books added
 * later; otherwise the GM ticks books, and Player Core is always in.
 */
function BooksField({ books, onChange }) {
  const picked = books ?? ALL_BOOKS;
  const toggle = (book) =>
    onChange(campaignBooks(picked.includes(book) ? picked.filter((b) => b !== book) : [...picked, book], ALL_BOOKS) ?? []);
  return (
    <fieldset className="form-field books">
      <legend>Books</legend>
      <label className="books__mode">
        <input type="radio" name="books-mode" checked={!books} onChange={() => onChange(null)} />
        <span>Every book, including ones added later</span>
      </label>
      <label className="books__mode">
        <input type="radio" name="books-mode" checked={Boolean(books)} onChange={() => onChange(campaignBooks([], ALL_BOOKS))} />
        <span>Only these books</span>
      </label>
      {books && (
        <ul className="books__list">
          {ALL_BOOKS.map((book) => (
            <li key={book}>
              <label>
                <input type="checkbox" checked={picked.includes(book)} disabled={book === CORE_BOOK} onChange={() => toggle(book)} />
                <span>{book}</span>
                {book === CORE_BOOK && <small className="muted"> (the core rules, always in)</small>}
              </label>
            </li>
          ))}
        </ul>
      )}
      <small className="muted italic">Players can only build characters from these books, and characters using other books can't join.</small>
    </fieldset>
  );
}

/**
 * Title, party level, books, backstory, and cover, with a live preview. Used to
 * create and edit. prefill names where suggested values came from (an Adventure
 * Path), so the form can say they're only a starting point: { from, backstory,
 * cover (a File) }. Nothing is saved until the form is submitted.
 */
export default function CampaignForm({ initial, prefill, submitLabel, onSubmit, children }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [partyLevel, setPartyLevel] = useState(initial?.partyLevel ?? 1);
  const [backstory, setBackstory] = useState(initial?.backstory ?? prefill?.backstory ?? '');
  // An "only these books" list that ends up with every book is stored as "every book".
  const [books, setBooks] = useState(initial?.books ?? null);
  const [cover, setCover] = useState(prefill?.cover ? { file: prefill.cover } : {});
  const [previewUrl, setPreviewUrl] = useState(initial?.coverUrl ?? null);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!cover.file) return setPreviewUrl(cover.remove ? null : initial?.coverUrl ?? null);
    const url = URL.createObjectURL(cover.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover, initial?.coverUrl]);

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setStatus(cover.file ? 'Uploading cover…' : 'Saving…');
    try {
      await onSubmit({ name, partyLevel, backstory, cover, books: books && campaignBooks(books, ALL_BOOKS) });
    } catch (err) {
      setErrors(errorsFrom(err));
      setStatus(null);
    }
  };

  return (
    <div className="split">
      <form className="split__col form" onSubmit={submit}>
        <label className="form-field">
          <span>Title</span>
          <input value={name} required maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="The Gilded Crypt" />
          <small className="muted counter">{name.length}/{NAME_MAX}</small>
        </label>

        <label className="form-field">
          <span>Party level</span>
          <select value={partyLevel} onChange={(e) => setPartyLevel(Number(e.target.value))}>
            {LEVELS.map((n) => <option key={n} value={n}>Level {n}</option>)}
          </select>
          <small className="muted italic">The level your heroes are at. Raise it as the party levels up.</small>
        </label>

        <BooksField books={books} onChange={setBooks} />

        <label className="form-field">
          <span>Backstory</span>
          {prefill?.backstory && backstory === prefill.backstory && (
            <span className="prefill-note">
              Filled in from {prefill.from}'s premise as a starting point. Your players will see it, so make it yours, or{' '}
              <button type="button" className="link-button" onClick={() => setBackstory('')}>start from blank</button>.
            </span>
          )}
          <textarea
            rows={9}
            maxLength={BACKSTORY_MAX}
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            placeholder="What do the heroes know when the story begins?"
          />
          <small className="muted counter">{backstory.length}/{BACKSTORY_MAX}</small>
        </label>

        <ImagePicker label="Cover image" hint="wide images work best" value={cover} currentUrl={initial?.coverUrl ?? null} onChange={setCover} />
        {prefill?.cover && cover.file === prefill.cover && (
          <p className="prefill-note">This is {prefill.from}'s cover. Keep it, choose your own, or remove it.</p>
        )}

        <FormErrors errors={errors} />
        <div className="btn-row">
          {children}
          <button type="submit" className="btn btn--blood btn--grow" disabled={Boolean(status) || !name.trim()}>
            {status ?? submitLabel}
          </button>
        </div>
      </form>

      <aside className="split__col" aria-label="Preview">
        <span className="eyebrow">Preview</span>
        <CampaignCover name={name || 'Your campaign'} coverUrl={previewUrl} subtitle={`Party level ${partyLevel}`} />
        <p className="rule-note">Books: {booksLabel(books && campaignBooks(books, ALL_BOOKS))}</p>
        {backstory.trim() ? <p className="backstory">{backstory}</p> : <p className="rule-note">Your backstory will appear here for your players.</p>}
      </aside>
    </div>
  );
}
