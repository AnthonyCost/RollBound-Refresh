import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import PageShell from '../components/PageShell.jsx';
import ImagePicker from '../components/ImagePicker.jsx';
import Avatar from '../components/Avatar.jsx';
import Icon from '../components/Icon.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import { useCampaignService } from '../state/campaignService.js';
import { placeholderCover } from '../state/campaignCovers.js';
import { THEMES, DEFAULT_THEME } from '../themes.js';
import { classArtOf, lineOf } from './CharactersPage.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import bannerArt from '../assets/auth-art-wide.webp';

const SHOWN = 6;

/**
 * Your account as a game profile: a banner with your avatar and name, your heroes and
 * campaigns as showcases, and your counts and theme down the side. Editing the profile and
 * changing the theme open in place of the showcases.
 */
export default function AccountPage() {
  const { user, isDemo, updateProfile, logout } = useAuth();
  const service = useCampaignService();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatar, setAvatar] = useState({});
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState('profile');
  const { state } = useLocation();
  // null until loaded, or if loading fails: the showcases are a nicety, so they just stay empty.
  const [table, setTable] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listCharacters(), service.list()])
      .then(([characters, campaigns]) => !cancelled && setTable({ characters, running: campaigns.running, playing: campaigns.playing }))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [service]);

  const changed = displayName.trim() !== user.displayName || Boolean(avatar.file || avatar.remove);
  const theme = THEMES.find((t) => t.id === (user.theme ?? DEFAULT_THEME)) ?? THEMES[0];
  const campaigns = table ? [...table.running.map((c) => ({ ...c, role: 'GM' })), ...table.playing.map((c) => ({ ...c, role: 'Player' }))] : [];
  const stats = [
    { to: '/characters', icon: 'shield', label: 'Characters', value: table?.characters.length },
    { to: '/campaigns', icon: 'crown', label: 'Campaigns you run', value: table?.running.length },
    { to: '/campaigns', icon: 'map', label: 'Campaigns you play', value: table?.playing.length },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setStatus(avatar.file ? 'Uploading…' : 'Saving…');
    try {
      const changes = { displayName };
      if (avatar.file) changes.avatarKey = await api.uploadImage(avatar.file, 'avatar');
      else if (avatar.remove) changes.avatarKey = null;
      await updateProfile(changes);
      setAvatar({});
      setSaved(true);
    } catch (err) {
      setErrors(errorsFrom(err));
    } finally {
      setStatus(null);
    }
  };

  const back = (
    <button type="button" className="link-button prof__back" onClick={() => setView('profile')}>‹ Back to your profile</button>
  );

  return (
    <PageShell crumbs={[{ label: 'Your account' }]}>
      <div className="prof">
        <header className="prof__banner">
          <img className="prof__banner-art" src={bannerArt} alt="" />
          <span className="prof__frame">
            <Avatar url={user.avatarUrl} name={user.displayName} size={132} />
          </span>
          <div className="prof__who">
            <h1 className="prof__name">{user.displayName}</h1>
            <p className="prof__line">{isDemo ? 'Demo account, deleted when you exit' : user.email}</p>
          </div>
          <div className="prof__actions">
            <button type="button" className="btn" aria-pressed={view === 'edit'} onClick={() => setView(view === 'edit' ? 'profile' : 'edit')}>
              <Icon name="user" size={16} /> Edit profile
            </button>
            <button type="button" className={`btn ${isDemo ? 'settings__delete' : ''}`} onClick={logout}>
              <Icon name="exit" size={16} /> {isDemo ? 'Exit demo' : 'Sign out'}
            </button>
          </div>
        </header>

        {state?.avatarFailed && !saved && (
          <p className="panel panel--hot center" role="status">
            Your account is ready, but the profile picture didn't upload. Try adding it again in Edit profile.
          </p>
        )}

        <div className="prof__body">
          <div className="prof__main">
            {view === 'edit' && (
              <section className="prof__panel" aria-labelledby="prof-edit">
                {back}
                <h2 id="prof-edit" className="prof__title">Edit profile</h2>
                <form className="form account__profile" onSubmit={submit}>
                  <label className="form-field">
                    <span>Display name</span>
                    <input value={displayName} required maxLength={60} onChange={(e) => { setDisplayName(e.target.value); setSaved(false); }} />
                    <small className="muted italic">Shown to your party and GMs.</small>
                  </label>
                  <ImagePicker
                    label="Profile picture"
                    shape="avatar"
                    maxMb={2}
                    hint="square images work best"
                    value={avatar}
                    currentUrl={user.avatarUrl}
                    onChange={(v) => { setAvatar(v); setSaved(false); }}
                  />
                  <FormErrors errors={errors} />
                  <div className="account__save">
                    {saved && <span className="field-check field-check--ok" role="status">✓ Profile saved</span>}
                    <button type="submit" className="btn btn--blood" disabled={Boolean(status) || !displayName.trim() || !changed}>
                      {status ?? 'Save profile'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {view === 'theme' && (
              <section className="prof__panel" aria-labelledby="prof-theme">
                {back}
                <h2 id="prof-theme" className="prof__title">Theme</h2>
                <ThemePicker bare />
              </section>
            )}

            {view === 'profile' && (
              <>
                <section className="prof__panel" aria-labelledby="prof-heroes">
                  <header className="prof__panel-head">
                    <h2 id="prof-heroes" className="prof__title">Heroes</h2>
                    {table?.characters.length > 0 && <Link to="/characters">All {table.characters.length}</Link>}
                  </header>
                  {table && !table.characters.length ? (
                    <p className="prof__empty">No heroes yet. <Link to="/create">Make your first</Link>.</p>
                  ) : (
                    <ul className="prof__heroes">
                      {(table?.characters ?? []).slice(0, SHOWN).map((c) => {
                        const art = c.portraitUrl ?? classArtOf(c).banner;
                        return (
                          <li key={c.id}>
                            <Link to={`/play/${c.id}/sheet`} className="prof-hero">
                              {art && <img className="prof-hero__art" src={art} alt="" />}
                              <span className="prof-hero__text">
                                <span className="prof-hero__name">{c.name}</span>
                                <span className="prof-hero__line">{lineOf(c)}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="prof__panel" aria-labelledby="prof-camps">
                  <header className="prof__panel-head">
                    <h2 id="prof-camps" className="prof__title">Campaigns</h2>
                    {campaigns.length > 0 && <Link to="/campaigns">All {campaigns.length}</Link>}
                  </header>
                  {table && !campaigns.length ? (
                    <p className="prof__empty">No campaigns yet. <Link to="/campaigns">Start or join one</Link>.</p>
                  ) : (
                    <ul className="prof__camps">
                      {campaigns.slice(0, SHOWN).map((c) => (
                        <li key={c.id}>
                          <Link to={`/campaigns/${c.id}`} className="prof-camp">
                            <img className="prof-camp__art" src={c.coverUrl ?? placeholderCover(c.id)} alt="" />
                            <span className="prof-camp__name">{c.name}</span>
                            <span className="prof-camp__role">{c.role === 'GM' ? 'You’re the GM' : `Playing · GM ${c.gmName}`}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="prof__side" aria-label="Your table">
            <ul className="prof__stats">
              {stats.map((s) => (
                <li key={s.label}>
                  <Link to={s.to} className="prof-stat">
                    <Icon name={s.icon} size={20} />
                    <span className="prof-stat__label">{s.label}</span>
                    <strong className="prof-stat__value">{s.value ?? '–'}</strong>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="prof__theme" data-theme={theme.id}>
              <span className="prof__theme-swatches" aria-hidden="true">
                {['--bg', '--panel', '--blood', '--bronze', '--gold'].map((t) => <i key={t} style={{ background: `var(${t})` }} />)}
              </span>
              <span className="prof__theme-name"><span className="prof__theme-kicker">Theme</span>{theme.name}</span>
              <button type="button" className="btn btn--small" aria-pressed={view === 'theme'} onClick={() => setView(view === 'theme' ? 'profile' : 'theme')}>Change</button>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
