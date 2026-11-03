// Builder choices for sample characters: Mira, a custom fighter the tests build, and
// Kestrel, the demo's pretend player Sam's ranger (server/src/demo.js). They're IDs into
// the rules data, so a re-import that changes them fails test/builder.test.js.
import { PREGENS } from './pregens.js';

export const SAMPLE_BUILDS = {
  "mira": {
    "v": 2,
    "name": "Mira Ashvale",
    "ancestry": "IiG7DgeLWYrSNXuX",
    "heritage": "hFBwsVcSnNCJoimo",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "str",
      "con"
    ],
    "background": "6UmhTxOQeqFnppxx",
    "backgroundBoosts": [
      "str",
      "wis"
    ],
    "lore": "Legal Lore",
    "class": "8zn3cD6GSmoo1LW4",
    "keyAbility": "str",
    "classSkill": "acrobatics",
    "classChoices": {},
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "str",
      "dex",
      "con",
      "wis"
    ],
    "skills": [
      "athletics",
      "medicine",
      "survival"
    ],
    "languages": [],
    "ancestryFeat": "lwLcUHQMOqfaNND4",
    "classFeat": "5FyvwI24mnROzh61",
    "bonusFeats": {
      "hFBwsVcSnNCJoimo": "AmP0qu7c5dlBSath"
    },
    "cantrips": [],
    "spells": [],
    "runes": [],
    "armor": "Kf4eJEXnFPuAsseP",
    "shield": null,
    "weapons": [
      "LJdbVTOZog39EEbi"
    ]
  },
  "kestrel": {
    "v": 2,
    "name": "Kestrel",
    "ancestry": "PgKmsA2aKdbLU6O0",
    "heritage": "nW1gi13E62Feto2w",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "dex",
      "int",
      "wis"
    ],
    "background": "5Z3cLEpsx9nHVwhM",
    "backgroundBoosts": [
      "dex",
      "wis"
    ],
    "lore": "Tanning Lore",
    "class": "Yix76sfxrIlltSTJ",
    "keyAbility": "dex",
    "classSkill": null,
    "classChoices": {
      "ranger-hunters-edge": "6v4Rj7wWfOH1882r"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "dex",
      "str",
      "con",
      "wis"
    ],
    "skills": [
      "nature",
      "stealth",
      "athletics",
      "acrobatics",
      "arcana",
      "crafting"
    ],
    "languages": [],
    "ancestryFeat": "WoLh16gyDp8y9WOZ",
    "classFeat": "1JnERVwnPtX620f2",
    "bonusFeats": {},
    "cantrips": [],
    "spells": [],
    "runes": [],
    "armor": "4tIVTg9wj56RrveA",
    "shield": null,
    "weapons": [
      "hIgqLgH3YcLZBeoT",
      "7tKkkF8eZ4iCLJtp"
    ]
  }
};

/** The demo visitor's characters: Valeros, the iconic fighter, then every other pregenerated hero. */
const VALEROS = PREGENS.find((p) => p.slug === 'valeros');
export const DEMO_ROSTER = [VALEROS.build, ...PREGENS.filter((p) => p !== VALEROS).map((p) => p.build)];
