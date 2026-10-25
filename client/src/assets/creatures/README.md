# Bestiary art

Two files per creature, named after its slug:

- `goblin-warrior.webp`: the whole picture, uncropped, shown on the creature's page.
  Fitted inside 900×1600, so 9:16 art keeps its full size and shape.
- `goblin-warrior-thumb.webp`: a 192×192 square for bestiary cards and the encounter
  picker, cut around the most detailed part of the picture (usually the face).

Creatures without art show without it.

Add art with `npm run art:creatures -- <folder>`. It matches each file to a creature by
name ("Goblin Warrior.webp", "goblin_warrior.png", or a pre-Remaster name all work),
makes both files, and lists any file it couldn't match. Running it again replaces them.

They are committed with the project, so the art shows wherever it runs.
