import { useEffect, useId, useRef, useState } from 'react';

const HIT_MS = 420;

// The shield's outline on a 100 x 120 grid, and the same shape inset for its rim line.
const OUTLINE = 'M50 4 C63 12 80 15 94 12 L94 50 C94 82 75 103 50 116 C25 103 6 82 6 50 L6 12 C20 15 37 12 50 4 Z';

// Fracture lines, drawn in the background colour so they read as gaps in the shield.
const CRACKS = {
  intact: [],
  chipped: ['M97 64 L79 73 L95 71'],
  cracked: ['M93 32 L72 58 L64 56 L44 88 L36 110'],
  shattered: ['M2 47 L30 44 L52 49 L98 41', 'M2 79 L44 74 L60 78 L98 71', 'M47 0 L53 47 L45 77 L55 120'],
};

/** How damaged a shield looks: whole, chipped, cracked, or shattered once it's broken. */
export function shieldStage({ current, max, brokenAt }) {
  if (current >= max) return 'intact';
  if (current <= brokenAt) return 'shattered';
  return current > (max + brokenAt) / 2 ? 'chipped' : 'cracked';
}

const STAGE_LABEL = { intact: 'undamaged', chipped: 'chipped', cracked: 'cracked', shattered: 'broken' };

/**
 * The equipped shield beside the health orb: it chips, cracks and shatters as it loses
 * Hit Points (shattered once it's broken, faded once it's destroyed), shakes when it
 * takes damage and glows while raised. The number on it is its current Hit Points.
 */
export default function ShieldGauge({ shield, raised = false, pressed = false, onOpen }) {
  const stage = shieldStage(shield);
  const clipId = `shield-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const previous = useRef(shield.current);
  const [hits, setHits] = useState(0);
  const [hit, setHit] = useState(false);
  useEffect(() => {
    const before = previous.current;
    previous.current = shield.current;
    if (shield.current >= before) return undefined;
    setHits((n) => n + 1);
    setHit(true);
    const id = setTimeout(() => setHit(false), HIT_MS);
    return () => clearTimeout(id);
  }, [shield.current]);

  const state = shield.destroyed ? 'Destroyed' : shield.broken ? 'Broken' : raised ? 'Raised' : null;
  return (
    <div className="vitals">
      <button
        type="button"
        className={`shield-gauge shield-gauge--${stage}${shield.destroyed ? ' shield-gauge--destroyed' : ''}${raised ? ' shield-gauge--raised' : ''}${hit ? ` shield-gauge--hit-${hits % 2}` : ''}`}
        aria-pressed={pressed}
        // Just a gauge when there's nothing to open (the encounter tracker's drawer).
        disabled={!onOpen}
        onClick={onOpen}
        aria-label={`${shield.name}: ${shield.current} of ${shield.max} Hit Points, ${shield.destroyed ? 'destroyed' : STAGE_LABEL[stage]}${raised ? ', raised' : ''}`}
      >
        <svg viewBox="0 0 100 120" aria-hidden="true">
          <defs>
            <clipPath id={clipId}><path d={OUTLINE} /></clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect className="shield-gauge__face shield-gauge__face--lit" x="0" y="0" width="50" height="120" />
            <rect className="shield-gauge__face" x="50" y="0" width="50" height="120" />
            <path className="shield-gauge__rim" d={OUTLINE} transform="translate(7 8.4) scale(0.86)" />
            {CRACKS[stage].map((d) => (
              <g key={d}>
                {/* A thin lit edge just below each gap gives it depth. */}
                <path className={`shield-gauge__glint shield-gauge__crack--${stage}`} d={d} transform="translate(1.6 1.8)" />
                <path className={`shield-gauge__crack shield-gauge__crack--${stage}`} d={d} />
              </g>
            ))}
          </g>
          <path className="shield-gauge__edge" d={OUTLINE} />
        </svg>
        <span className="shield-gauge__hp">{shield.current}</span>
      </button>
      <span className="vitals__max">
        Hardness <strong>{shield.hardness}</strong>
      </span>
      {state && <span className={`vitals__status ${state === 'Raised' ? 'vitals__status--raised' : ''}`}>{state}</span>}
    </div>
  );
}
