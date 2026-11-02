// Placeholder covers, so a campaign without its own cover still has art. The ID picks one,
// so a campaign keeps the same cover, and two made in a row get different ones.
import pirateCove from '../assets/campaign-covers/pirate-cove.webp';
import mountainShrine from '../assets/campaign-covers/mountain-shrine.webp';
import nightForest from '../assets/campaign-covers/night-forest.webp';
import snowyVillage from '../assets/campaign-covers/snowy-village.webp';
import { adventureCover } from './adventureCovers.js';

const PLACEHOLDERS = [nightForest, pirateCove, snowyVillage, mountainShrine];

export const placeholderCover = (id) => PLACEHOLDERS[Math.abs(Number(id) || 0) % PLACEHOLDERS.length];

/** The art for a campaign: its own cover, its adventure path's, or a placeholder. */
export const campaignCover = (c) => c.coverUrl ?? adventureCover(c.adventurePath) ?? placeholderCover(c.id);
