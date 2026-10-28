// Builder choices for the demo account's characters (server/src/demo.js): Mira, the
// player's fighter; Kestrel, the pretend player Sam's ranger; and a hero for each class
// no pregenerated hero plays (magus, necromancer, psychic, runesmith, summoner,
// thaumaturge). They're IDs into the rules data, so a re-import that changes them fails
// test/builder.test.js.
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
  },
  "dhalia": {
    "v": 2,
    "name": "Dhalia Venn",
    "ancestry": "IiG7DgeLWYrSNXuX",
    "heritage": "N36ZR4lh9eCazDaN",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "str",
      "int"
    ],
    "background": "6UmhTxOQeqFnppxx",
    "backgroundBoosts": [
      "str",
      "con"
    ],
    "lore": "Warfare Lore",
    "class": "aon-class-74",
    "keyAbility": "str",
    "classSkill": null,
    "classChoices": {
      "magus-hybrid-study": "aon-hybrid-study-10"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "str",
      "dex",
      "con",
      "int"
    ],
    "skills": [
      "intimidation",
      "arcana",
      "athletics",
      "acrobatics",
      "society",
      "occultism"
    ],
    "languages": [],
    "ancestryFeat": "4NKyZVkmWjDyyIYZ",
    "classFeat": null,
    "bonusFeats": {},
    "cantrips": [
      "TVKNbcgTee19PXZR",
      "gpzpAAAJ1Lza2JVl",
      "kBhaPuzLUSwS6vVf",
      "IxhGEKl63R4QBvkj",
      "6DfLZBl8wKIV03Iq",
      "WBmvzNDfpwka3qT4",
      "60sgbuMWN0268dB7",
      "Qw3fnUlaUbnn7ipC"
    ],
    "spells": [
      "Gb7SeieEvd0pL2Eh",
      "zDJS8E66UI0himqV",
      "gKKqvLohtrSJj3BM",
      "aAbfKn8maGjJjk2W",
      "Q7QQ91vQtyi1Ux36"
    ],
    "runes": [],
    "armor": "MPcM4Wt6KmWE2kGL",
    "shield": null,
    "weapons": [
      "LJdbVTOZog39EEbi"
    ]
  },
  "orsk": {
    "v": 2,
    "name": "Orsk Gallowmere",
    "ancestry": "BYj5ZvlXZdpaEgA6",
    "heritage": "VTtXwBxrfRUXSL38",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "con",
      "wis",
      "int"
    ],
    "background": "2Mm0BHMJZhqIqoQG",
    "backgroundBoosts": [
      "int",
      "con"
    ],
    "lore": "",
    "class": "aon-class-75",
    "keyAbility": "int",
    "classSkill": null,
    "classChoices": {
      "necromancer-fatal-method": "aon-fatal-method-2",
      "necromancer-grim-fascination": "aon-grim-fascination-2"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "int",
      "dex",
      "con",
      "wis"
    ],
    "skills": [
      "medicine",
      "occultism",
      "arcana",
      "society",
      "athletics",
      "nature",
      "survival",
      "intimidation"
    ],
    "languages": [],
    "ancestryFeat": "9bnkx6VgcO5mOk5b",
    "classFeat": null,
    "bonusFeats": {},
    "cantrips": [
      "mAMEt4FFbdqoRnkN",
      "gpzpAAAJ1Lza2JVl",
      "WBmvzNDfpwka3qT4",
      "TVKNbcgTee19PXZR",
      "60sgbuMWN0268dB7",
      "4gBIw4IDrSfFHik4",
      "vLzFcIaSXs7YTIqJ",
      "Qw3fnUlaUbnn7ipC"
    ],
    "spells": [
      "aon-spell-2646",
      "k34hDOfIIMAxNL4a",
      "4koZzrnMXhhosn0D",
      "J7Y7tl0bbdz7TcCc"
    ],
    "runes": [],
    "armor": null,
    "shield": null,
    "weapons": [
      "FVjTuBCIefAgloUU"
    ]
  },
  "wren": {
    "v": 2,
    "name": "Wren Halloway",
    "ancestry": "CYlfsYLJcBOgqKtD",
    "heritage": "d0bNxgGqvaCkFlhN",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "con",
      "cha",
      "int"
    ],
    "background": "v0WPfxN6G8XFfFZT",
    "backgroundBoosts": [
      "int",
      "wis"
    ],
    "lore": "Academia Lore",
    "class": "aon-class-68",
    "keyAbility": "int",
    "classSkill": null,
    "classChoices": {
      "psychic-subconscious-mind": "aon-subconscious-mind-6",
      "psychic-conscious-mind": "aon-conscious-mind-7"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "int",
      "dex",
      "con",
      "wis"
    ],
    "skills": [
      "occultism",
      "arcana",
      "society",
      "nature",
      "religion",
      "medicine",
      "deception",
      "diplomacy"
    ],
    "languages": [],
    "ancestryFeat": "mxhGH4FVYXJwb0BC",
    "classFeat": null,
    "bonusFeats": {},
    "cantrips": [
      "4gBIw4IDrSfFHik4",
      "gpzpAAAJ1Lza2JVl",
      "TVKNbcgTee19PXZR"
    ],
    "spells": [
      "R8bqnYiThB6MYTxD"
    ],
    "runes": [],
    "armor": null,
    "shield": null,
    "weapons": [
      "FVjTuBCIefAgloUU"
    ]
  },
  "brannoc": {
    "v": 2,
    "name": "Brannoc Ironquill",
    "ancestry": "BYj5ZvlXZdpaEgA6",
    "heritage": "5CqsBKCZuGON53Hk",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "con",
      "wis",
      "str"
    ],
    "background": "6irgRkKZ8tRZzLvs",
    "backgroundBoosts": [
      "int",
      "str"
    ],
    "lore": "Guild Lore",
    "class": "aon-class-76",
    "keyAbility": "int",
    "classSkill": "arcana",
    "classChoices": {},
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "int",
      "str",
      "con",
      "dex"
    ],
    "skills": [
      "crafting",
      "arcana",
      "athletics",
      "society",
      "occultism",
      "religion",
      "medicine",
      "intimidation"
    ],
    "languages": [],
    "ancestryFeat": "CXS0ryG2SODSobm9",
    "classFeat": "aon-feat-9169",
    "bonusFeats": {},
    "cantrips": [],
    "spells": [],
    "runes": [
      "aon-runesmith-rune-1",
      "aon-runesmith-rune-4",
      "aon-runesmith-rune-5",
      "aon-runesmith-rune-11"
    ],
    "armor": "AnwzlOs0njF9Jqnr",
    "shield": null,
    "weapons": [
      "rXt4629QSg7KDTgJ"
    ]
  },
  "pell": {
    "v": 2,
    "name": "Pell Thistlewick",
    "ancestry": "GgZAHbrjnzWOZy2v",
    "heritage": "xtRIYizCjLg9qe1Z",
    "heritageSkill": null,
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "dex",
      "wis",
      "cha"
    ],
    "background": "5RGLAPi5sLykRcmm",
    "backgroundBoosts": [
      "cha",
      "wis"
    ],
    "lore": "",
    "class": "aon-class-77",
    "keyAbility": "cha",
    "classSkill": null,
    "classChoices": {
      "summoner-eidolon": "aon-eidolon-17"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "cha",
      "dex",
      "con",
      "wis"
    ],
    "skills": [
      "nature",
      "intimidation",
      "survival",
      "stealth",
      "acrobatics",
      "diplomacy"
    ],
    "languages": [],
    "ancestryFeat": "ZbRVqf14RTJJIZXG",
    "classFeat": "aon-feat-9224",
    "bonusFeats": {},
    "cantrips": [
      "uZK2BYzPnxUBnDjr",
      "kBhaPuzLUSwS6vVf",
      "gpzpAAAJ1Lza2JVl",
      "WBmvzNDfpwka3qT4",
      "SnjhtQYexDtNDdEg"
    ],
    "spells": [
      "4YnON9JHYqtLzccu"
    ],
    "runes": [],
    "armor": "4tIVTg9wj56RrveA",
    "shield": null,
    "weapons": [
      "UCH4myuFnokGv0vF",
      "rQWaJhI5Bko5x14Z"
    ]
  },
  "ysolde": {
    "v": 2,
    "name": "Ysolde Marrow",
    "ancestry": "IiG7DgeLWYrSNXuX",
    "heritage": "zVf0Hlp5xG0Q7kmc",
    "heritageSkill": "diplomacy",
    "altAncestryBoosts": false,
    "ancestryBoosts": [
      "cha",
      "con"
    ],
    "background": "3frMfODIYFeqTl2k",
    "backgroundBoosts": [
      "cha",
      "wis"
    ],
    "lore": "Fortune-Telling Lore",
    "class": "aon-class-69",
    "keyAbility": "cha",
    "classSkill": null,
    "classChoices": {
      "thaumaturge-first-implement-and-esoterica": "aon-implement-20"
    },
    "classChoiceSkills": {},
    "tradition": null,
    "deity": null,
    "font": null,
    "sanctification": null,
    "freeBoosts": [
      "cha",
      "str",
      "con",
      "dex"
    ],
    "skills": [
      "occultism",
      "arcana",
      "nature",
      "religion",
      "diplomacy",
      "intimidation",
      "deception",
      "medicine",
      "athletics"
    ],
    "languages": [],
    "ancestryFeat": "RmiMUZlae6yGUyXY",
    "classFeat": "aon-feat-8356",
    "bonusFeats": {},
    "cantrips": [],
    "spells": [],
    "runes": [],
    "armor": "4tIVTg9wj56RrveA",
    "shield": null,
    "weapons": [
      "9iDqOLNFKxiTcFKE"
    ]
  }
};

/** The demo visitor's characters: Mira, then one of every other class the builder offers. */
export const DEMO_ROSTER = [
  SAMPLE_BUILDS.mira,
  ...PREGENS.filter((p) => p.classSlug !== 'fighter').map((p) => p.build),
  ...['dhalia', 'orsk', 'wren', 'brannoc', 'pell', 'ysolde'].map((k) => SAMPLE_BUILDS[k]),
];
