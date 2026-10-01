> Historical snapshot archived 2026-10-01. Earlier revisions/proposals, not current main. [Current docs index](../../../../README.md).

# Image prompts for faction unit sprite sheets (four units per sheet)

Matches the sprite pipeline in `docs/asset-pipeline-plan.md`: upright, camera-facing cutouts, Brenna's proportions (about 6.5 heads, slender, fine outlines). Sources are never edited; split each sheet into `design_assets/<unit>_sprite.png` and run `tools/assets/prep_sprites.py`. Until real art exists, new classes use a tinted, labelled base sprite.

## Shared style block (start every prompt with it)

Game character sprite sheet, four different fantasy soldiers standing side by side in one row, equal spacing, no overlap, all at the same scale and the same ground line. Full body from head to boots, upright standing pose, 3/4 view facing slightly to the viewer's right, weapon held naturally. Slender adult proportions, about 6.5 heads tall, long limbs, defined waist, fitted boots, fine clean dark outlines, painterly illustration with soft cel shading, muted rich colours, matte cloth and fur, polished metal with a hard highlight, simplified armour with a few readable details. Readable at small size: strong silhouette, one dominant colour per unit. Plain flat solid magenta (#FF00FF) background, no ground, no cast shadow, no text, no labels, no frame, no watermark, no magenta or purple anywhere on the characters.

## Sheet 1: Argent Crown (royal blue #1A4FA0, polished steel #B8C4D6, gold #F0B830 trim, leather #5C381E)

[style block] Four soldiers of the Argent Crown kingdom, blue-and-silver heraldry with a small crown-and-interlocked-shields emblem. From left to right: (1) Crown Guard, heavy infantry in steel half-plate with blue tabard, tall heater shield with the emblem and a short pike, solid and planted. (2) Bannerman, lightly armoured officer in chainmail and blue surcoat, carrying a tall blue-and-silver standard on a pole, arming sword at the hip, bare-headed with a cap. (3) Oathsworn, a paladin-class knight in full polished plate with a long blue cape and a white ribbon tied round the sword arm, kite shield, closed helm with a small gold crest, calm and protective. (4) Levy Bowman, a village archer in a leather jerkin and blue hood with a simple longbow and quiver, practical rather than noble.

## Sheet 2: White Fang Clans (iron #6B7280, dark fur, bone-white teeth, deep crimson #A8231C accents, leather brown)

[style block] Four heavily armoured northern clan warriors, riveted iron plate, layered wolf fur, carved shoulder guards and helms shaped like beasts, monster teeth and fangs strung on the armour as trophies, no bare torsos. From left to right: (1) White Fang Reaver, wolf-pelt cloak over half-plate, bearded axe in one hand, aggressive forward-leaning stance. (2) Axeguard, the heaviest, iron plate with a carved wooden buckler and a broad bearded axe, stocky and braced. (3) Berserker, scarred veteran in half-armour hung with monster teeth and bone charms, two-handed axe, wild hair, crimson war paint across the face. (4) Fang Hunter, a clan archer in fur and leather with an antler-and-bone recurve bow and a quiver of bone-tipped arrows, wolf-skull shoulder guard.

## Sheet 3: Iron League (brass #B5843A, bronze, oxidised green patina #4E7C6A, dull iron, canvas and rope)

[style block] Four soldiers of a mercenary league that fields salvaged ancient machines. Everything is patched, corroded and hand-repaired: brass and bronze plate with green patina, mismatched rivets, rope wraps, leather straps, stencilled numbers, faint glowing amber lens or lantern on some pieces. Practical, not sci-fi clean; it should look like a salvage yard on soldiers. From left to right: (1) Pavise Guard, infantryman behind a tall rectangular relic-plate shield with a viewing slit, short pike, brass helm. (2) Coil Crossbowman, crossbow with a coil-spring mechanism and gear housing, brass sight, satchel of bolts. (3) Relic Walker, a bulky pilot inside a dented ancient armoured frame, exposed pistons and pipes, one arm ending in a short barrel cannon, small amber light in the chest. (4) Sapper, a lightly armoured engineer with a heavy pack of tools, a folding shovel-pick and a lantern with a brass lens, goggles.

## Sheet 4: Hollow Court (bone white #E8E1CF, ash grey, black velvet, pale candle gold #D9C27A, cold grey-teal #5B7A7A)

[style block] Four undead soldiers of a dead aristocratic civilization: elegant, formal and eerie rather than gory. Tattered black velvet and grey silk livery, pale skin or exposed bone, faintly glowing candle-gold or grey-teal eyes, black-and-silver plate, veils, old heraldic crests, rust and dust. No blood, no green slime. From left to right: (1) Feral Ghoul, hunched, thin, grey-skinned, torn livery, long clawed hands, low aggressive stance. (2) Graveguard, pale household soldier in black-and-silver plate with a tattered surcoat, marching pike and round shield, helm with a closed visor. (3) Mourning Knight, armoured knight with a black mourning veil over the helm, rusted crest, longsword point-down, worn cape; mounted on a skeletal barded horse (this figure may be larger than the others but keep it in the row). (4) Necromancer, tall robed court official in black velvet and grey silk with a high collar, staff topped with a hanging candle lantern, holding a small open book.

## Follow-up sheet (faction cavalry)

Use the same style block with "four riders": Crown Cavalier (blue barding), Fang Rider (shaggy northern warhorse with iron chamfron), League Dragoon (brass rig on a armoured mount), Court Pale Rider (skeletal horse).

## Notes

- One sheet per faction; if scale is inconsistent, regenerate one unit at a time with the same style block and "identical scale, same ground line".
- The magenta background is keyed out afterwards; no magenta in the units.
- Champions for the League and Court are not designed yet; add a champions sheet once chosen.
