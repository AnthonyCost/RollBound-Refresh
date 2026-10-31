import { LIMITS, abilityName } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import { useRules } from '../state/useRules.js';
import { titleCase } from '../format.js';

const LORE_TYPES = ['backgrounds', 'feats'];
const ALL_ATTRIBUTES = 6;
const savedLabel = { waiting: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Check your connection; keep typing to try again." };

/** "Strength or Intelligence" for a boost slot, or "a free boost" when any attribute fits. */
const slotLabel = (slot) => (slot.length >= ALL_ATTRIBUTES ? 'a free boost' : slot.map(abilityName).join(' or '));

/** The character's story: the player's backstory, and where they come from by the rules. */
export default function LorePage() {
  const { character, readOnly, backstory, setBackstory, backstoryStatus } = useTable();
  const rules = useRules(LORE_TYPES);
  const build = character.build;
  const background = rules?.backgrounds?.find((b) => b.id === build?.background) ?? rules?.backgrounds?.find((b) => b.name === character.background);
  const featName = (id) => rules?.feats?.find((f) => f.id === id || f.slug === id)?.name;

  const origins = [
    ['Ancestry', character.ancestry.name],
    ['Heritage', character.heritage],
    ['Background', character.background],
    ['Class', character.className],
    ['Deity', character.deity?.name],
    ['Languages', character.languages?.map(titleCase).join(', ')],
  ].filter(([, v]) => v);

  return (
    <div className="sheet__columns lore-tab">
      <section className="sheet-panel lore-backstory" aria-labelledby="backstory-title">
        <h1 id="backstory-title" className="sheet-panel__title">Backstory</h1>
        {readOnly ? (
          backstory.trim() ? <p className="lore-backstory__text">{backstory}</p> : <p className="muted italic">No backstory written yet.</p>
        ) : (
          <>
            <textarea
              className="lore-backstory__input"
              rows={10}
              maxLength={LIMITS.backstory}
              value={backstory}
              placeholder={`Where did ${character.name} grow up? What drove them to adventure? Who do they miss, owe, or hunt?`}
              onChange={(e) => setBackstory(e.target.value)}
              aria-label="Backstory"
            />
            <p className="lore-backstory__foot">
              <span className={backstoryStatus === 'error' ? 'rule-note--warn' : ''} role="status">{savedLabel[backstoryStatus] ?? ''}</span>
              <span className="muted">{backstory.length.toLocaleString('en-US')} / {LIMITS.backstory.toLocaleString('en-US')}</span>
            </p>
          </>
        )}
      </section>

      <div className="sheet__col">
      <section className="sheet-panel origins" aria-labelledby="origins-title">
        <h2 id="origins-title" className="sheet-panel__title">Origins</h2>
        <dl className="origins__list">
          {origins.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="sheet-panel background" aria-labelledby="background-title">
        <h2 id="background-title" className="sheet-panel__title">Background: {character.background}</h2>
        {!rules && <p className="muted italic">Loading…</p>}
        {rules?.error && <p className="rule-note rule-note--warn">Couldn't load the background's rules. Try refreshing.</p>}
        {background && (
          <>
            <div className="option__desc background__desc" dangerouslySetInnerHTML={{ __html: background.description }} />
            <dl className="origins__list">
              <div>
                <dt>Attribute boosts</dt>
                <dd>
                  {background.boosts.map(slotLabel).join(', and ')}
                  {build?.backgroundBoosts?.length > 0 && <span className="muted"> (chose {build.backgroundBoosts.map(abilityName).join(' and ')})</span>}
                </dd>
              </div>
              <div>
                <dt>Trained in</dt>
                <dd>{[...background.skills.map(titleCase), ...(build?.lore ? [build.lore] : background.lore)].join(', ') || '—'}</dd>
              </div>
              {background.feats.length > 0 && (
                <div>
                  <dt>Skill feat</dt>
                  <dd>{background.feats.map((f) => featName(f) ?? titleCase(f.replace(/-/g, ' '))).join(', ')}</dd>
                </div>
              )}
            </dl>
          </>
        )}
        {rules && !rules.error && !background && <p className="muted italic">This background isn't in the current rules data.</p>}
      </section>
      </div>
    </div>
  );
}
