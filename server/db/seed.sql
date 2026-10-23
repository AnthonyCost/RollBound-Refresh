-- Demo data: one user, one campaign, and Mira, a level 1 human fighter.
-- Safe to run more than once.

INSERT INTO users (email, display_name)
VALUES ('demo@rollbound.local', 'Demo Player')
ON CONFLICT (email) DO NOTHING;

INSERT INTO campaigns (name, gm_user_id, party_level)
SELECT 'Wolves at the Ford', u.id, 1
FROM users u
WHERE u.email = 'demo@rollbound.local'
  AND NOT EXISTS (SELECT 1 FROM campaigns WHERE name = 'Wolves at the Ford');

INSERT INTO characters (owner_id, campaign_id, name, level, data)
SELECT u.id, c.id, 'Mira Ashvale', 1, $json$
{
  "name": "Mira Ashvale",
  "level": 1,
  "ancestry": { "name": "Human", "hp": 8, "speed": 25 },
  "heritage": "Versatile Human",
  "background": "Guard",
  "className": "Fighter",
  "classHp": 10,
  "keyAbility": "str",
  "abilities": { "str": 4, "dex": 2, "con": 2, "int": 0, "wis": 1, "cha": 0 },
  "proficiencies": {
    "perception": "expert",
    "fortitude": "expert",
    "reflex": "expert",
    "will": "trained",
    "armor": { "unarmored": "trained", "light": "trained", "medium": "trained", "heavy": "trained" },
    "weapons": { "unarmed": "expert", "simple": "expert", "martial": "expert", "advanced": "trained" }
  },
  "skills": { "acrobatics": "trained", "athletics": "trained", "intimidation": "trained", "medicine": "trained", "survival": "trained" },
  "lores": ["Warfare Lore"],
  "armor": { "name": "Chain mail", "category": "medium", "acBonus": 4, "dexCap": 1, "strength": 3, "checkPenalty": -2, "traits": ["flexible", "noisy"] },
  "weapons": [
    { "name": "Longsword", "category": "martial", "die": 8, "damageType": "slashing", "traits": ["versatile P"] }
  ],
  "heroPoints": 1
}
$json$::jsonb
FROM users u, campaigns c
WHERE u.email = 'demo@rollbound.local'
  AND c.name = 'Wolves at the Ford'
  AND NOT EXISTS (SELECT 1 FROM characters WHERE name = 'Mira Ashvale');
