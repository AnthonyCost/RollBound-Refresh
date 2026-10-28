import { formatPrice } from '@rollbound/rules';
import { cap } from './labels.js';

export const bulkLabel = (b) => (b == null ? null : b > 0 && b < 1 ? 'Light' : b === 0 ? 'Negligible' : String(b));

/**
 * An item's numbers for a book page, by kind: armor, shield, weapon, or any other gear.
 * Only the kind's own list is built: shields have no category, weapons no AC bonus.
 */
export function gearFacts(kind, x) {
  const own =
    kind === 'armor'
      ? [
          ['Category', cap(x.category)],
          ['AC bonus', `+${x.acBonus}`],
          ['Dex cap', x.dexCap != null ? `+${x.dexCap}` : null],
          ['Strength', x.strength ? `+${x.strength}` : null],
          ['Check penalty', x.checkPenalty || null],
          ['Speed penalty', x.speedPenalty ? `${x.speedPenalty} ft` : null],
        ]
      : kind === 'shield'
        ? [
            ['AC when raised', `+${x.acBonus}`],
            ['Hardness', x.hardness],
            ['Hit Points', x.hp],
          ]
        : kind === 'weapon'
          ? [
              ['Damage', `1d${x.die} ${x.damageType}`],
              ['Category', cap(x.category)],
              ['Group', x.group && cap(x.group)],
              ['Hands', x.hands],
              ['Range', x.range ? `${x.range} ft` : null],
            ]
          : [
              ['Level', x.level || null],
              ['Usage', x.usage && cap(x.usage.replace(/-/g, ' '))],
            ];
  return [...own, ['Traits', x.traits?.map(cap).join(', ')], ['Bulk', bulkLabel(x.bulk)], ['Price', x.price != null ? formatPrice(x.price) : null]];
}
