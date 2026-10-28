const RANKS = ['trained', 'expert', 'master', 'legendary'];

/**
 * A proficiency rank as the character sheet shows it: four diamonds for trained,
 * expert, master and legendary, filled up to the rank. Screen readers hear the rank.
 */
export default function RankPips({ rank = 'untrained' }) {
  const filled = RANKS.indexOf(rank) + 1;
  return (
    <span className="rank-pips" title={rank[0].toUpperCase() + rank.slice(1)}>
      {RANKS.map((r, i) => <span key={r} className={`rank-pips__pip ${i < filled ? 'rank-pips__pip--on' : ''}`} aria-hidden="true" />)}
      <span className="visually-hidden">{rank}</span>
    </span>
  );
}
