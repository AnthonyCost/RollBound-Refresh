// Builder choices for the demo account's characters (server/src/demo.js): Mira, the
// player's fighter, and Kestrel, the pretend player Sam's ranger. They're IDs into
// the rules data, so a re-import that changes them fails test/builder.test.js.
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
