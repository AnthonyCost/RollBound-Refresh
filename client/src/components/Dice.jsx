import { useEffect, useState } from 'react';

// The dice, in 3D: d4, d6, d8, d10, d12, d20, and d100 as two d10s (tens and units). Each is
// a real solid, rotated each frame and projected into a 100 × 100 SVG grid, its visible faces
// dark and lit from the upper left, outlined in the theme's colour (--die-*, theme.css). A
// fresh roll spins it (fast, then slowing) until it rests with its number face toward you.

const PHI = (1 + Math.sqrt(5)) / 2;
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mul = (m, v) => m.map((row) => dot(row, v));
const matMul = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const centroid = (ps) => [0, 1, 2].map((k) => ps.reduce((t, p) => t + p[k], 0) / ps.length);

/** A turn of angle t about an axis (Rodrigues). */
function axisAngle([x, y, z], t) {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [[c + x * x * k, x * y * k - z * s, x * z * k + y * s], [y * x * k + z * s, c + y * y * k, y * z * k - x * s], [z * x * k - y * s, z * y * k + x * s, c + z * z * k]];
}

// The d10: a pentagonal trapezohedron. Two rings of five, offset by 36°, between two apexes
// set so each kite face is flat.
const D10_A = 0.105;
const D10_H = (D10_A * (1 + Math.cos(Math.PI / 5))) / (1 - Math.cos(Math.PI / 5));
const ringAt = (z, offset) => Array.from({ length: 5 }, (_, k) => [Math.cos((2 * Math.PI * k) / 5 + offset), Math.sin((2 * Math.PI * k) / 5 + offset), z]);

/** Each die's corners. */
const CORNERS = {
  4: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  6: [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))),
  8: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  10: [[0, 0, D10_H], [0, 0, -D10_H], ...ringAt(D10_A, 0), ...ringAt(-D10_A, Math.PI / 5)],
  12: [
    ...[-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z]))),
    ...[-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [[0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [a * PHI, 0, b / PHI]])),
  ],
  20: [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]],
};

/**
 * A convex solid's faces from its corners: every plane through three corners with all the
 * others on one side, its corners ordered around it so the face's normal points outward.
 */
function hullFaces(vs) {
  const faces = [];
  const seen = new Set();
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) for (let k = j + 1; k < vs.length; k++) {
    let n = cross(sub(vs[j], vs[i]), sub(vs[k], vs[i]));
    if (Math.hypot(...n) < 1e-9) continue;
    n = norm(n);
    let d = dot(n, vs[i]);
    const side = vs.map((p) => dot(n, p) - d);
    if (side.some((x) => x > 1e-6) && side.some((x) => x < -1e-6)) continue;
    if (side.some((x) => x > 1e-6)) { n = n.map((x) => -x); d = -d; }
    const on = vs.map((_, m) => m).filter((m) => Math.abs(dot(n, vs[m]) - d) < 1e-6);
    const key = on.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const c = centroid(on.map((m) => vs[m]));
    const u = norm(sub(vs[on[0]], c));
    const w = cross(n, u);
    on.sort((a, b) => Math.atan2(dot(sub(vs[a], c), w), dot(sub(vs[a], c), u)) - Math.atan2(dot(sub(vs[b], c), w), dot(sub(vs[b], c), u)));
    faces.push(on);
  }
  return faces;
}

const LIGHT = norm([-0.45, -0.6, 0.65]);
// Each die rests with its number face toward you. The d10 tips it up a little, so the faces
// below show and give it depth; the rest are face-on.
const view = (x, z = 0) => matMul(axisAngle([1, 0, 0], x), axisAngle([0, 0, 1], z));
const TILT = {
  // The cube comes to rest corner-up (a diamond); an eighth of a turn stands it square.
  6: view(0, Math.PI / 4),
  10: view(0.35),
};
// The number's size on each die, in grid units (and cqi in the roller).
const TEXT_SIZE = { 4: 22, 6: 30, 8: 22, 10: 20, 12: 24, 20: 22 };

/**
 * Each die, ready to draw: its corners and faces, its resting turn (face 0 toward the viewer,
 * its farthest corner straight up, leaned back for a d4 or d6), and the scale and offset that
 * fit it in the grid at rest, with where its number sits.
 */
const SOLIDS = Object.fromEntries(Object.entries(CORNERS).map(([sides, raw]) => {
  const vs = raw.map((p) => { const r = Math.max(...raw.map((q) => Math.hypot(...q))); return p.map((x) => x / r); });
  const faces = hullFaces(vs);
  const front = faces[0].map((m) => vs[m]);
  const c = centroid(front);
  const z = norm(cross(sub(front[1], front[0]), sub(front[2], front[0])));
  const far = front.reduce((a, b) => (Math.hypot(...sub(b, c)) > Math.hypot(...sub(a, c)) ? b : a));
  const lift = sub(far, c);
  const y = norm(sub(lift, z.map((x) => x * dot(lift, z)))).map((x) => -x);
  const rest = matMul(TILT[sides] ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [cross(y, z), y, z]);
  const seen = vs.map((p) => mul(rest, p));
  const xs = seen.map((p) => p[0]), ys = seen.map((p) => p[1]);
  // A flat square fills its box more than the other shapes, so the d6 rests a little smaller.
  const scale = ((sides === '6' ? 40 : 46) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))) * 2;
  const offset = [50 - ((Math.max(...xs) + Math.min(...xs)) / 2) * scale, 50 - ((Math.max(...ys) + Math.min(...ys)) / 2) * scale];
  const label = mul(rest, c);
  return [sides, { vs, faces, rest, scale, offset, text: [offset[0] + label[0] * scale, offset[1] + label[1] * scale, TEXT_SIZE[sides]] }];
}));
// Self-check: each solid has the faces its name promises.
for (const [sides, s] of Object.entries(SOLIDS)) console.assert(s.faces.length === Number(sides), `d${sides} has ${s.faces.length} faces`);

/** The faces seen under turn m, as [points, light 0–1], back faces dropped. */
function facesUnder(solid, m) {
  const v = solid.vs.map((p) => mul(m, p));
  return solid.faces.map((f) => {
    const n = norm(cross(sub(v[f[1]], v[f[0]]), sub(v[f[2]], v[f[0]])));
    return n[2] > 0.01 ? [f.map((k) => `${(solid.offset[0] + v[k][0] * solid.scale).toFixed(1)},${(solid.offset[1] + v[k][1] * solid.scale).toFixed(1)}`).join(' '), Math.max(0, dot(n, LIGHT))] : null;
  }).filter(Boolean);
}
const REST_FACES = Object.fromEntries(Object.entries(SOLIDS).map(([sides, s]) => [sides, facesUnder(s, s.rest)]));

/** Where a die's number sits on its resting front face, as percentages of the die, and its size (cqi). */
export const dieTextAt = (sides) => {
  const [x, y, size] = SOLIDS[sides === 100 ? 10 : sides].text;
  return { left: `${x}%`, top: `${y}%`, fontSize: `${size * 0.92}cqi` };
};

/**
 * One die in 3D, with an optional label on its front face. spin: ms to tumble before it
 * comes to rest (a fresh roll); without it (or with reduced motion) it rests at once.
 */
export function DieShape({ sides, label = null, className = '', spin = null }) {
  const solid = SOLIDS[sides];
  const [faces, setFaces] = useState(REST_FACES[sides]);
  useEffect(() => {
    if (!spin || reducedMotion()) return undefined;
    const axis = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const turns = (3 + Math.random()) * Math.PI;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / spin);
      const left = 1 - t;
      // Fast at first, slowing as it settles: the turn still to go shrinks with the cube of the time left.
      setFaces(t < 1 ? facesUnder(solid, matMul(solid.rest, axisAngle(axis, turns * left * left * left))) : REST_FACES[sides]);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spin, sides, solid]);
  const [x, y, size] = solid.text;
  return (
    <svg className={`die__shape ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      {/* Dark faces lit from the upper left, outlined in the die's bright colour. */}
      {faces.map(([pts, light]) => (
        <polygon key={pts} className="die-3d__face" points={pts} style={{ fill: `color-mix(in oklab, var(--die-edge) ${Math.round(12 + light * 33)}%, var(--die-low))` }} />
      ))}
      {label != null && (
        <text className="die__value" x={x} y={y} fontSize={String(label).length > 2 ? size * 0.75 : size} textAnchor="middle" dominantBaseline="central">
          {label}
        </text>
      )}
    </svg>
  );
}

/** The d20 (the roller's check die). */
export const D20 = (props) => <DieShape sides={20} {...props} />;

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
        <DieShape sides={10} label={tens} spin={tumble} />
        <DieShape sides={10} label={units} spin={tumble} />
      </span>
    );
  }
  return (
    <span className={`die ${tumble != null && landed ? 'die--landed' : ''}`} role="img" aria-label={name} style={{ '--die-size': `${size}px` }}>
      <DieShape sides={sides} label={value} spin={tumble} />
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
