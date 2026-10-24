// The rules data, loaded once on first use, for checks the server makes itself
// (which books a character's choices come from). About 1 MB in memory.
import { loadRulesData } from '@rollbound/rules/load';

let data = null;
export const rulesData = () => (data ??= loadRulesData());
