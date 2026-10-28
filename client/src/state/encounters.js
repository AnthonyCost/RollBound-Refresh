// Encounter helpers shared by the Encounters tab and the campaign Overview: the party an
// encounter is built for, and how threatening it is for them.
import { rateEncounter } from '@rollbound/rules';

/**
 * The party an encounter is built for when the GM hasn't set one: the campaign's
 * characters, at their average level. With nobody in the party yet, a table of four
 * at the campaign's party level.
 */
export function autoParty(campaign) {
  const chars = campaign.characters;
  if (!chars.length) return { size: 4, level: campaign.partyLevel, fromCharacters: false };
  const level = Math.round(chars.reduce((t, c) => t + c.level, 0) / chars.length);
  return { size: Math.min(8, chars.length), level: Math.max(1, Math.min(20, level)), fromCharacters: true };
}

/** The party an encounter uses: its own size and level where set, otherwise the campaign's. */
export const partyFor = (encounter, campaign) => {
  const auto = autoParty(campaign);
  return { size: encounter.partySize ?? auto.size, level: encounter.partyLevel ?? auto.level };
};

/** An encounter's threat and XP for its party (its own, or the campaign's). */
export const encounterRating = (encounter, campaign) => {
  const party = partyFor(encounter, campaign);
  return { ...rateEncounter(encounter.creatures, party.level, party.size), party };
};
