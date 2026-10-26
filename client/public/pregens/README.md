# Pregenerated hero sheets

Paizo's level 1 iconic character sheets, as PDFs named `Pregens-<Hero>-Lvl1.pdf`.
They're served as they are at `/pregens/<file>.pdf`, and the builder's
pregenerated-hero gallery links each one.

Each hero whose class the builder offers is also transcribed by name in
`packages/rules/pregens/specs.js`; `npm run pregens -w packages/rules` turns those
into builds in `packages/rules/src/pregens.js`, which is what the builder loads.
