import { useEffect, useState } from 'react';

// The dice, drawn face-on as inline SVG on a 100 × 100 grid: d4, d6, d8, d10, d12, d20, and
// d100 as two d10s (tens and units). Every face takes the theme's colours through --die-*
// (theme.css, .die and .roll__gem), so the dice match each theme and each roll's result.

const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const ring = (n, r, start, cx = 50, cy = 50) => Array.from({ length: n }, (_, i) => {
  const a = ((start + (360 / n) * i) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});

// A d12: the front pentagon, and the five faces around it out to a ten-sided outline.
const D12_IN = ring(5, 22, -90, 50, 52);
const D12_OUT = ring(10, 47, -90, 50, 52);

/** Each die's faces ([shade, points]) and where its number sits. Shades: front, light, side, low. */
const SHAPES = {
  4: {
    faces: [
      ['front', '50,8 89,80 11,80'],
      ['low', '11,80 89,80 95,90 5,90'],
    ],
    text: [50, 58, 30],
  },
  6: {
    faces: [
      ['front', '8,30 70,30 70,92 8,92'],
      ['light', '8,30 30,8 92,8 70,30'],
      ['side', '70,30 92,8 92,70 70,92'],
    ],
    text: [39, 63, 34],
  },
  8: {
    faces: [
      ['front', '50,4 80,64 20,64'],
      ['side', '50,4 20,64 6,50'],
      ['side', '50,4 94,50 80,64'],
      ['low', '6,50 20,64 50,96'],
      ['low', '20,64 80,64 50,96'],
      ['low', '80,64 94,50 50,96'],
    ],
    text: [50, 46, 26],
  },
  10: {
    faces: [
      ['front', '50,4 74,50 50,64 26,50'],
      ['side', '50,4 26,50 6,46'],
      ['side', '50,4 94,46 74,50'],
      ['low', '6,46 26,50 50,64 50,96'],
      ['low', '94,46 74,50 50,64 50,96'],
    ],
    text: [50, 40, 24],
  },
  12: {
    faces: [
      ['front', pts(D12_IN)],
      ...D12_IN.map((p, k) => [k === 0 || k === 1 || k === 4 ? 'side' : 'low', pts([p, D12_OUT[2 * k], D12_OUT[(2 * k + 1) % 10], D12_OUT[(2 * k + 2) % 10], D12_IN[(k + 1) % 5]])]),
    ],
    text: [50, 54, 26],
  },
  20: {
    faces: [
      ['light', '50,2 8,26 50,18'],
      ['light', '50,2 92,26 50,18'],
      ['side', '8,26 18,70 50,18'],
      ['side', '92,26 82,70 50,18'],
      ['side', '8,26 8,74 18,70'],
      ['side', '92,26 92,74 82,70'],
      ['low', '8,74 18,70 50,98'],
      ['low', '18,70 82,70 50,98'],
      ['low', '82,70 92,74 50,98'],
      ['front', '50,18 82,70 18,70'],
    ],
    text: [50, 54, 26],
  },
};

/** Where a die's number sits on its front face, as percentages of the die, and its size (cqi). */
export const dieTextAt = (sides) => {
  const [x, y, size] = SHAPES[sides === 100 ? 10 : sides].text;
  return { left: `${x}%`, top: `${y}%`, fontSize: `${size * 0.92}cqi` };
};

/** One die's shape, with an optional label on its front face. */
export function DieShape({ sides, label = null, className = '' }) {
  const shape = SHAPES[sides];
  // The front face is drawn last, so its edges sit on top.
  const faces = [...shape.faces.filter(([s]) => s !== 'front'), ...shape.faces.filter(([s]) => s === 'front')];
  const [x, y, size] = shape.text;
  return (
    <svg className={`die__shape ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      {faces.map(([shade, p]) => <polygon key={p} className={`roll__die-face roll__die-face--${shade}`} points={p} />)}
      {label != null && (
        <text className="die__value" x={x} y={y} fontSize={String(label).length > 2 ? size * 0.75 : size} textAnchor="middle" dominantBaseline="central">
          {label}
        </text>
      )}
    </svg>
  );
}

/** How long a die tumbles before it lands (ms). */
export const TUMBLE_MS = 520;
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A rolled number tumbling through a die's faces (1 to faces), slowing as it goes, then
 * landing on the real result after ms. With reduced motion it lands at once. Returns [shown, landed].
 */
export function useTumble(final, faces = 20, ms = TUMBLE_MS) {
  const face = () => Math.ceil(Math.random() * faces);
  const [shown, setShown] = useState(() => (reducedMotion() ? final : face()));
  const [landed, setLanded] = useState(reducedMotion);
  useEffect(() => {
    const land = () => { setShown(final); setLanded(true); };
    if (reducedMotion()) return land();
    setLanded(false);
    let frame;
    let last = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / ms;
      if (t >= 1) return land();
      // Faces change quickly at first, then slower, like a die running out of energy.
      if (now - last > 30 + t * t * 110) {
        last = now;
        setShown(face());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [final, faces, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return [shown, landed];
}

/**
 * A die, with the number it rolled (or none, as an icon). A d100 is two d10s: the tens die
 * (00 to 90) and the units die (0 to 9); 100 shows as 00 and 0.
 */
export function Die({ sides, value = null, size = 64, tumble = null }) {
  // tumble: ms to spin through the die's faces before showing value (a fresh roll); null shows it at once.
  const [spun, landed] = useTumble(value ?? 1, sides, tumble ?? 0);
  const name = `d${sides}${value != null ? `: ${value}` : ''}`;
  if (tumble != null && value != null) value = spun;
  if (sides === 100) {
    const tens = value != null ? String(Math.floor((value % 100) / 10) * 10).padStart(2, '0') : '00';
    const units = value != null ? String(value % 10) : '0';
    return (
      <span className={`die die--d100 ${tumble != null && landed ? 'die--landed' : ''}`} role="img" aria-label={name} style={{ '--die-size': `${size}px` }}>
        <DieShape sides={10} label={tens} />
        <DieShape sides={10} label={units} />
      </span>
    );
  }
  return (
    <span className={`die ${tumble != null && landed ? 'die--landed' : ''}`} role="img" aria-label={name} style={{ '--die-size': `${size}px` }}>
      <DieShape sides={sides} label={value} />
    </span>
  );
}

const DAMAGE_TYPES = 'acid|bludgeoning|cold|electricity|fire|force|mental|piercing|poison|slashing|sonic|spirit|vitality|void|bleed|precision|persistent|untyped';
const DICE_TEXT = new RegExp(`(\\b\\d*d(?:4|6|8|10|12|20|100)\\b(?:\\s*[+\\-−]\\s*\\d+\\b)?)(\\s+(?:${DAMAGE_TYPES})\\b)?`, 'gi');

/**
 * Rules text with every dice expression ("2d6 fire", "1d4+1") boxed as a button that rolls
 * it: <button data-dice="2d6" data-type="fire">. Only text between tags is touched.
 */
export function boxDice(html) {
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.replace(DICE_TEXT, (m, expr, type = '') => (
      `<button type="button" class="dice-roll" data-dice="${expr.replace(/\s+/g, '').replace('−', '-')}" data-type="${type.trim().toLowerCase()}" aria-label="Roll ${m.trim()}">${m}</button>`
    ))))
    .join('');
}

/** A weapon's damage dice as an expression: 1d8 and +4 make "1d8+4". */
export const damageExpr = (die, mod) => `1d${die}${mod ? `${mod > 0 ? '+' : '-'}${Math.abs(mod)}` : ''}`;

/** A damage amount boxed as a button that rolls it, with its die drawn beside the text. */
export function DamageButton({ label, expr, die, damageType = '', onRoll, className = '', children }) {
  return (
    <button type="button" className={`dice-roll dice-roll--damage ${className}`} aria-label={`Roll ${label} damage: ${expr}${damageType ? ` ${damageType}` : ''}`} onClick={() => onRoll(label, expr, damageType)}>
      <Die sides={die} size={20} />
      <span>{children}</span>
    </button>
  );
}
