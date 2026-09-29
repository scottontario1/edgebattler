# Character and environment asset pipeline proposal

Originally written 28 September 2026 as a plan; revised 29 September 2026 with what was built and learned (see **As built**). The sprite direction is now the game's production path for all five unit classes, and the terrain has a painted pass. The original 3D research is retained further down as an optional fallback.

**Decision record:** the illustrated 3D humanoid (Blender-built Brenna, Dreg and recruits) was replaced by supplied 2D sprites on the 3D map. No Meshy/Rodin subscription, Blender rig or local image generation was needed. The 3D models still load with `?sprites=0` for comparison and as a fallback.

Approved transparent artwork → consistent scale and foot anchor → sprite renderer on the 3D map → desktop/mobile review → directional artwork → short animation loops → shared sprite library.

## As built (29 September 2026)

### Sprites
| Piece | Where | What it does |
| --- | --- | --- |
| Source art | `design_assets/{brenna,dreg,pikeman,archer,cavalier}_sprite.png` | Supplied, transparent, roughly 1122-1182 x 1330-1402. Never edited. |
| Prep script | `tools/assets/prep_sprites.py` | Trims to the alpha bounding box, sizes by anatomy, Lanczos-downscales to 300 px per world unit, writes `public/sprites/<name>.png`, a `_red` variant for recruits, and `manifest.json`. |
| Manifest | `public/sprites/manifest.json` | Per sprite: files by faction, crop box, scale, foot anchor (fraction of the image), world `height`, `footWidth`, `headTop`. The renderer reads everything from here. |
| Renderer | `src/sprites.js` | Upright camera-facing plane, alpha-tested (0.5), unlit `MeshBasicMaterial`, stretched by 1/cos(tilt) so the drawing keeps its proportions, contact shadow, alpha-mask picking, subtle breathing stretch. |
| Wiring | `src/units.js` | Every class routes through `buildSprite(cls, faction, {flip})`; red mirrors to face the blue army; `?sprites=0` uses the 3D models. |

### Lessons that changed the plan
- **The supplied art is not on a clean pixel grid.** Grid detection found no consistent block size (AI-made pixel-style art, resampled), so smooth Lanczos minification is the right treatment; nearest filtering was not needed.
- **Scale by anatomy, never by image bounds.** Sizing every sprite to the same bounding-box height shrank the pikeman (halberd) and made the cavalier look small. Each entry now gives the head-top row (source px) and a world foot-to-head height: recruits share `STAND_RECRUIT` (1.05), Brenna is 1.25, Dreg 1.3. The cavalier has no visible feet, so his rider's head size is matched to the infantry's; horses and weapons come out at their drawn size. Adjacent occupied tiles were tested (`docs/redesign/scale-row.png`).
- **Foot anchor:** x is the centroid of the lowest opaque band (both boots), y the lowest opaque row. Where a weapon butt pollutes the band (pikeman) an explicit `feet` x-range overrides it.
- **Ground contact needs a shadow.** A soft radial contact shadow sized from the drawing's own foot span (`footWidth`) removed the "hovering above the ring" look. A more elevated drawing angle needs new art.
- **Faction colours without new art:** recruit sprites are drawn in blue; the prep script hue-shifts only saturated blue pixels (hue 0.52-0.74, saturation > 0.35) to crimson, leaving steel, leather and skin. Side effect: blue eyes become red. Heroes keep fixed palettes and rely on the faction ring.
- **Post-processing interactions.** The ambient-occlusion pass renders every sprite as a solid rectangle (its depth/normal override ignores alpha), leaving a light box of unoccluded ground around each unit; the quads are hidden for that pass only. ACES tone mapping dulls unlit sprites slightly, so the material has a 1.08 gain.
- **Picking follows the drawing:** the plane's `raycast` samples the texture alpha, so clicks pass through transparent cape and weapon areas.
- **The style mismatch is an art problem, not a code problem.** Brenna and Dreg are long-limbed with fine detail; the three recruit sprites are chibi (about 3.6 heads, heavy outlines). The fix is regenerating the recruits in Brenna's style (6-7 heads, slender limbs, fine outlines, simplified armour), same canvas, transparent, feet on the bottom row.

### Terrain (painted pass)
| Piece | Where | What it does |
| --- | --- | --- |
| Watercolor source | `art/textures/watercolor/` (16 x 1024 px, CC0, Jonas Voland / Voxel Core Lab) | Kept out of `public/`. Credited in `CREDITS.md`. |
| Detail-map prep | `tools/assets/prep_terrain_textures.py` | The washes are too dark and flat to replace our colours, so each becomes a neutral grey (0.5) detail map: per-channel mean removed, contrast normalised to a target luminance std (gain capped at 5), 512 px JPEG in `public/textures/painted/`. |
| Loader | `src/paint.js` | `PAINT_SETS` (grass/dirt/stone/water x 4), `loadPaint()` (never rejects), `paintTile(set, n)`. |
| Blending | `src/textures.js` `paintDetail()` | `soft-light` over the meadow (two scales, offset), roads (dirt), rock, paving, forest floor and the river colour. Adds brushy variation without changing the base palette or lighting. |
| Painterly filter | `src/painterly.js` | Kuwahara (radius 2, 4 quadrants) after bloom. Sprites are masked out: the mask pass renders the scene flat black (filling depth), then the sprites on `MASK_LAYER` through a cutout material, so trees in front of a unit still hide it. P toggles it; `?paint=0` starts with it off. |
| Earlier tone-down | `src/map.js`, `src/textures.js` | Fewer, softer grass strokes; water normal, clearcoat and rock foam reduced; pine palette lifted out of near-black; orange oaks rare; softer forest shade. |

Not done yet: ink outlines on trees and rocks, painted cliff and building textures, a warmer and brighter light pass, castle-to-unit scale.

### Map building foundation
- `src/terrain.js`: the `TERRAIN` registry (stats, block height, atlas `ground` class, props) and `parseLayout()` validation.
- `src/maps/river_ford.js`: a map as plain data (ASCII layout plus `hills`); `src/map.js` builds from it.
- `src/main.js`: preloading bootstrap (`loadPaint()`; add tilesets and atlases here), then imports `src/game.js`.
- Still hard-coded in `map.js`: roads, the river island, rocks, village plots and unit spawn positions. Move these into the map files before adding a second map.

### Verification practice that worked
Fixed-camera captures with `node tools/shot.mjs` (`zoom`, `focus`, `select`, `place=id:c,r` for adjacency tests), before/after pairs in `docs/redesign/`, a click test on a sprite, the mobile viewport, and `npm run build`. The GPU cost of the mask pass and the filter has not been profiled (rAF counts in headless Chrome are not a GPU measure).

## What is causing the current mismatch

The review brief is design input, not a set of implementation commands. Several specifications should change to achieve the user's stated goal.

| Finding | Implication |
| --- | --- |
| `humanoid.py` gives the body a height of 1.18 and the head a height of 0.32, approximately 3.69 heads. | The implementation follows the brief's miniature proportions. That is a major contributor to the youthful, oversized-head silhouette. |
| Brenna and Dreg's reference paintings have mature anatomy, long legs, layered garments, and substantial material detail. | Use these for character identity and costume; simplify them deliberately into a separate game-model reference. |
| `top_down.png` presents small, strongly outlined, sprite-like figures in a richly illustrated environment. | It establishes composition and readability, but does not establish that every character must be rendered as real-time 3D. |
| Faces use separate geometric decal shapes; clothing and armor rely largely on material colors and geometry. | The models lack much of the painted information that makes the references appealing. |
| `src/models.js` replaces each imported material using its name. | New textured GLBs would lose their maps. The sprite prototype should use a separate texture/material path that bypasses this replacement logic. |
| Characters use rigid node rotations, without skeletons or animation clips. | A sprite renderer needs its own frame/state animation. Skeletal skinning is relevant only if we later return to 3D character production. |
| Grass, rocks, water, and trees have strong local contrast in the browser capture. | Character redesign needs a small lighting/environment pass so the terrain supports the units. |

The current GLB audit found:

| Asset | Triangles in mesh definitions, including baked outlines | Material primitives | Textures / skins / animation clips |
| --- | ---: | ---: | --- |
| Brenna | 27,672 | 59 | 0 / 0 / 0 |
| Dreg | 27,296 | 52 | 0 / 0 / 0 |
| Pikeman | 21,736 | 53 | 0 / 0 / 0 |
| Archer | 23,380 | 52 | 0 / 0 / 0 |
| Cavalier rider | 25,212 | 57 | 0 / 0 / 0 |
| Horse | 17,588 | 16 | 0 / 0 / 0 |

These are file-level counts, not measured frame draw calls. They show that reducing tiny mesh/material divisions and adding good textures is a more promising investment than increasing polygon counts.

## Proposed art direction

Use **painted fantasy anime characters with mature proportions and simplified tactical silhouettes**. Treat the named inspirations as references for specific qualities rather than combining their names into every generation prompt.

- Use the new sprites as the initial silhouette references. Preserve their mature anatomy and compare them at the same visible game height as the current units. If proportions need adjustment, compare 5.5, 6, and 6.5 heads tall; do not regenerate acceptable art simply to satisfy a ratio.
- Preserve a compact footprint, angular armor, a readable waist, connected sleeves/trousers, and well-shaped boots. Use consistent illustrated anatomy across the roster and a broader silhouette for Dreg.
- Give each character three defining visual features. Brenna: lavender hair, ivory/gold armor, royal-blue cape. Dreg: broad fur mantle, auburn beard, large axe. Carry intricate heraldry in portraits and texture accents rather than dozens of geometry details.
- Use cobalt `#1A4FA0`, crimson `#A8231C`, ivory `#E7DFCC`, warm leather `#5C381E`, and restrained antique gold `#C79B48` as starting swatches. Match final colors after rendering, not just in a texture editor.
- For sprites, bake the painted color variation, highlights, and linework into the image and preserve them with an unlit runtime material. Consistent light direction across characters matters. Runtime toon lighting belongs to the optional 3D route.
- Aim for approximately **0.75–1.25 CSS pixels** of exterior contour at normal desktop zoom; review at mobile and maximum zoom. Use dark colored ink and fewer internal outlines. The brief's fixed `-0.015` Solidify setting is not a portable art standard: sign, scale, normals, zoom, and renderer all affect the result.
- Author sprites in the actual ready pose. Preserve equipment and cape in the image; an A-pose or empty hands are unnecessary for this route. Do not make facial detail carry normal-zoom class recognition.
- Blender modifiers, mesh normals, and inverted-hull outlines apply only to a later 3D source. The initial sprites already contain their surface detail and outlines.

## Sprite approach: the first production path

The two new references are the intended kind of asset: complete illustrated characters isolated on transparent backgrounds. Both files are **1122 × 1402 RGBA PNGs**, with alpha ranging from 0 to 255. Their dark preview background is not an opaque black rectangle baked across the canvas.

Brenna preserves lavender hair, blue cape, ivory/gold armor, sword, and staff. Dreg preserves his broad fur mantle, auburn beard, and axe. They are useful first candidates. They are individual still images, not directional animation sheets. Their dense ornament and pixel-like rendering need a small-scale review; high-resolution pixel-styled artwork is not automatically a clean low-resolution pixel grid.

| Route | When to use it | Status |
| --- | --- | --- |
| Direct illustrated PNGs on the 3D map | Test the supplied artwork immediately | **Primary first milestone.** |
| Edited directional sprites and small frame loops | Add facing and movement after the static look passes | Next step; watch character consistency. |
| Layered 2D animation, baked into frames | Add subtle cape/hair/arm motion while retaining the same drawing | Optional if useful; hidden areas need painting and overlap cleanup. |
| Blender model rendered into sprite sheets | Many facings or complex animation exceed practical 2D editing effort | Deferred production fallback. |
| Real-time skinned 3D | Freely rotating cameras or battle closeups require it | Deferred alternative. |

### Milestone 1: static Brenna and Dreg in the game

1. Preserve the source PNGs. Prepare runtime copies with consistent padding and explicit foot anchors. Trim transparent margins only with recorded offsets; otherwise size and ground contact will shift between assets.
2. Add a separate sprite implementation, for example `src/sprites.js`, with the same root/update/selection interface as the existing unit visuals. Route only Brenna and Dreg through it behind a comparison flag. Keep tile positions, selection, HP, and combat data independent of the artwork.
3. Put each image on a camera-facing plane or sprite with its foot anchor at the unit's terrain height. Keep its world scale stable during zoom. Match the current character's visible standing height initially; aspect ratio and transparent padding must not determine body scale accidentally.
4. Preserve painted colors with an unlit material and correct texture color space. Avoid applying the GLB material-name replacement system. Check the complete post-processing output: an unlit material can still be affected by bloom, tone mapping, and screen-space effects.
5. Start with alpha-tested cutouts and depth testing/writing; tune the cutoff against hair and cape edges. Inspect on light and dark terrain. If soft transparency is necessary, handle ordering explicitly. Do not render every character on top of all scenery. A flat billboard has approximate depth, so test bridges, trees, neighboring units, and steep ground before accepting it.
6. Use a separate ground shadow and the existing faction/selection markers. The drawing should contain no baked ground plane or large cast shadow. Keep foot position fixed if adding a small idle motion; avoid whole-body bobbing that reintroduces the toy appearance.
7. Test normal zoom, maximum zoom, desktop, and mobile. First compare the supplied artwork as-is. Only request simpler detail or a different viewing angle when an actual screenshot demonstrates the need.

**Status: passed on 29 September 2026, for all five classes.** **Gate:** both sprites look preferable to the old models at normal gameplay size; transparent edges are clean; feet are grounded; no serious terrain occlusion or selection errors; class/faction remain readable; no console errors. A still-image prototype is sufficient for this decision.

The current map camera is 40 degrees above horizontal on desktop and 52 degrees in portrait. The new drawings read as three-quarter character illustrations rather than exact renders from those elevations. This can be an intentional illustrated presentation. Try the same sprites in both layouts first. If they appear pasted on, compare an elevated-view revision or a common camera elevation. Change framing separately; do not demand two complete angle libraries before the first test. Free camera orbit is outside the first sprite milestone.

### Milestone 2: controlled facings and minimal animation

After the static result passes, create matching left/right three-quarter views, then rear views if movement needs them. The first static prototype can use one facing; the eventual movement target is four directional sets. Do not simply mirror Brenna's asymmetric sword/staff or armor and treat that as final production art.

Produce one pilot character before the roster: approximately **4 idle frames, 6 walk frames, and 4 attack frames for one facing**, played at a starting 6–10 frames per second. These are proposed test budgets, not requirements to generate all frames immediately. Game movement controls tile translation; the walk loop stays in place. Add hit/defeat states after the basic loops pass. Fewer well-matched frames are preferable to a longer inconsistent sequence.

Use the accepted sprite as the reference for every edit. Keep canvas, scale, foot baseline, camera, palette, outfit, and weapon-hand assignment fixed. Align and compare frames as an onion-skin overlay; reject changing faces, disappearing equipment, shifting feet, or armor that reshapes between frames. Independent text prompts or an unreviewed AI video are not a reliable sprite-sheet pipeline.

For subtle motion, test a layered cape/hair pass with painted overlap regions. For complex walk/attack motion, compare tightly controlled image edits with artist cleanup. If the pilot cannot hold identity after two focused revision rounds, try an offline Blender rig/render workflow for that character. Meshy/Rodin are optional sources at that point, not prerequisites.

**Gate:** one short loop reads naturally in the game without visual identity drift or foot sliding. Then extend facings and classes.

### Sprite sizing, filtering, and memory

- Review artwork at 64, 96, and 128 pixels of visible character height, then at the actual game scale. Simplify filigree into larger color groups if it turns into noise.
- Compare smooth minification against a deliberately cleaned pixel-art export with nearest filtering. Do not assume nearest filtering will improve a large generated image when it is heavily downscaled. Choose one treatment for the cast.
- Start with 256-pixel-high runtime frame candidates; compare 512 only when close zoom needs it. Preserve the large source files.
- Store frame rectangles, duration, direction, untrimmed size, crop offset, and foot pivot in an atlas manifest. Add padding/extruded edge colors to prevent atlas bleed.
- A 2048 × 2048 RGBA8 texture is about 16 MiB before mipmaps, approximately 21.3 MiB with a full mip chain. Compressed PNG file size is not GPU memory use. Group and load atlases deliberately rather than keeping every class/animation at maximum resolution resident.
- For recruits, use a cloth color mask or separately approved faction variants. Do not tint the entire illustration red or blue. Keep readable faction ground markers on heroes whose costume palette should remain fixed.

### Production order and initial cost

1. ✅ Static Brenna and Dreg using the two existing images. ✅ Pikeman, archer and cavalier from supplied sprites (proportion mismatch pending regenerated art).
2. One consistent directional/animation pilot, then matching treatment for the second hero.
3. Pikeman and archer sharing the established image style and frame conventions.
4. Cavalier as a combined horse/rider sprite per frame; review the pair together for contact and silhouette.
5. Environment alignment: reduce grass noise and excessive water highlights, harmonize trees/stone, and compare with `top_down.png`.

The first milestone requires **no new paid 3D service** and can use the supplied images without further generation. Later image-editing costs depend on the generator or subscription already available. The first goal is a screenshot comparison, not purchasing a full animation toolchain.

Suggested source/output layout:

```text
design_assets/brenna_sprite.png       supplied source, preserved
design_assets/dreg_sprite.png         supplied source, preserved
art/sprites/<character>/              approved frames and editable/layered sources
public/sprites/<character>/           runtime PNGs/atlases and manifest
tools/assets/                        validation, packing and review helpers
docs/asset-reviews/                   fixed-camera screenshots and decisions
```

Agents can handle manifests, integration, packing, size/alpha checks, screenshot automation, and frame comparisons. Use image generation for artwork and guided variants, with visual review of identity and animation consistency. Record prompts, generator versions, source hashes, and credits/attribution with each accepted asset.

## Local free tools for the GTX 1080

Research added 28 September 2026 from upstream GitHub documentation and Reddit discussions. Assume a standard GTX 1080 with 8 GB VRAM; the machine has not been benchmarked and system RAM is unknown. No tools or model weights were installed during this research.

**Recommended local stack:** ComfyUI with an SD 1.5 model for image edits, optionally Krita AI Diffusion as a painting interface, and Pixelorama for frame cleanup and sprite-sheet export. Keep the supplied sprites as the identity references. The existing static-sprite milestone still comes first and requires no inference software.

| Tool | Purpose | Fit for this project |
| --- | --- | --- |
| [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Local generation, image-to-image, inpainting, repeatable workflows | First backend to try. Use the upstream Windows portable build specifically labeled CUDA 12.6 / NVIDIA 10-series, rather than assuming the default package supports Pascal. |
| [Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion) | Paint a correction or mask and regenerate that region; reference and pose guidance | Optional artist-facing interface over ComfyUI. Connect to the compatible existing backend and install only its required nodes/models. The project recommends at least 6 GB NVIDIA VRAM, which is a memory guideline, not a GTX 1080 performance guarantee. |
| [Pixelorama](https://github.com/Orama-Interactive/Pixelorama) | Pixel/frame editing, animation, sprite-sheet export | MIT-licensed editor; use for pivots, frame consistency, palette cleanup, and export. It does not require AI inference. |
| [Krita](https://krita.org/en/) | High-resolution paint cleanup and layered source artwork | Useful for preserving the painted detail in our current images before making smaller runtime exports. |
| [ControlNet](https://github.com/lllyasviel/ControlNet) | Guide output with pose, line art, or depth | Add one SD 1.5-compatible control at a time after basic generation works. The upstream project documents a low-VRAM mode for 8 GB GPUs. |
| [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) | Alternative local inference engine using C/C++, including CUDA/Vulkan backends | Backup if the Python stack proves difficult. Backend/model support is not evidence of tested performance on this GPU; avoid maintaining two stacks initially. |

### Hardware constraints and a small benchmark

The GTX 1080 is useful for a restrained image workflow. Its Pascal architecture lacks the fast low-precision paths of newer RTX hardware. The ComfyUI GPU guide describes the performance limitation; the current installation README explicitly provides a 10-series-compatible portable package. Preserve a working environment instead of blindly upgrading its bundled PyTorch/CUDA. [Upstream GPU guidance](https://github.com/Comfy-Org/ComfyUI/wiki/Which-GPU-should-I-buy-for-ComfyUI), [portable installation](https://github.com/Comfy-Org/ComfyUI#installing)

Start with these proposed settings, then measure:

1. One SD 1.5-compatible illustration model, batch size 1, 512 × 512, about 20 sampling steps. Test a simple image edit before adding extensions.
2. For our tall sprites, try 512 × 640 once the baseline works. Preserve the source aspect ratio with padding rather than stretching. Produce one frame at a time.
3. Test a masked cape or armor edit on Brenna, preserving her face and equipment. Begin with modest image-to-image denoising around 0.25–0.4; larger pose changes need pose guidance and a different balance.
4. Add one ControlNet pose or line-art input. Add reference conditioning only after checking memory and quality; do not begin with several control networks and an animation model simultaneously.
5. Record cold load time separately from generation time, peak VRAM, resolution, steps, and accepted results. Try three repeated edits and a four-frame idle pilot. Do not promise seconds per image before this test.
6. Try SDXL only if the SD 1.5 result is inadequate and the runtime/RAM budget permits. ComfyUI supports SDXL and offloading, so 8 GB does not categorically exclude it. Extra controls and large resolutions change memory needs. Full video generation, large 3D pipelines, and model training are deferred experiments.

Local software is free to run without generation credits; compute time, electricity, storage, and cleanup remain costs. Open-source application licenses and model-weight licenses are separate: SD 1.5 weights use CreativeML OpenRAIL-M, and each chosen checkpoint/LoRA needs its own recorded terms. [SD model source/license](https://huggingface.co/CompVis/stable-diffusion)

### What the Reddit/GitHub search changes

A [May 2026 Reddit discussion about Pascal GPUs](https://www.reddit.com/r/StableDiffusion/comments/1tfs3ee/running_modern_ai_image_models_on_a_gtx_1060_6gb/) includes reports of SDXL working on 6 GB cards, but commenters dispute parts of the author's Windows-memory and precision explanations. Treat these as community anecdotes motivating a benchmark, not installation instructions or promised speed. Use the official compatible ComfyUI package as the installation source.

Two specialized repositories are worth knowing about, but neither should be a dependency of the first milestone:

- [Pixel Art Studio](https://github.com/velteyn/pixel-art-studio) advertises directional generation, pose controls, frame alignment, and sheet export. Its own README requires **10+ GB VRAM**, above this GPU's standard capacity. The advertised automation has not been tested here.
- [SDDj](https://github.com/FeelTheFonk/SDDj) integrates SD 1.5/AnimateDiff into Aseprite and advertises 8 GB+ for animation/control workflows. That does not confirm GTX 1080 compatibility, and Aseprite is an additional dependency. Prefer the smaller ComfyUI/Pixelorama workflow first.

### If we revisit local image-to-3D

[TripoSR](https://github.com/VAST-AI-Research/TripoSR) is a reasonable small experiment: upstream documents approximately **6 GB VRAM** for a single-image reconstruction and an MIT license covering code and pretrained weights. That makes it a memory-fit candidate, not a confirmed Pascal installation or a source of finished rigged characters. Test a simple prop before attempting Brenna's layered costume.

[Hunyuan3D-2](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) documents **6 GB for shape generation and 16 GB for shape plus texture**; [TRELLIS](https://github.com/microsoft/TRELLIS) lists a **16 GB minimum** for its standard setup. Neither full pipeline is the easy default for this 8 GB card. Reduced-memory forks may exist, but introduce a separate compatibility project. These also have their own model licenses; a public GitHub repository alone does not establish unrestricted use.

## Are Meshy and Rodin free?

Checked 28 September 2026. Both offer free exploration, but full production/export capabilities have limits. Neither is needed for the direct sprite prototype.

| Service | Free offering | Practical limitation |
| --- | --- | --- |
| Meshy | 100 monthly credits; its specific free-plan help page lists 10 monthly downloads of Meshy 6 Lite models | Downloads from Meshy 6/7 require upgrading; free outputs require attribution under CC BY 4.0. [Free-plan details](https://help.meshy.ai/en/articles/15696428-what-is-included-on-the-free-plan) |
| Hyper3D Rodin | $0 plan with free generation previews before confirmation and legacy-model export | Pay-by-result credit spending applies; direct credits are listed at US$1.50 each. Creator starts at US$30/month billed monthly; the US$24/month figure requires annual billing. [Pricing](https://hyper3d.ai/pricing) |

Meshy's broader comparison page conflicts with its specific free-plan article on free downloads. Treat the limited Lite allowance as what the detailed article advertises and verify the account's export eligibility before spending time on a model. Free preview access is not a promise of free exports from the latest generator. Meshy's listed Pro monthly price is US$20. [Plan comparison](https://help.meshy.ai/en/articles/12062933-which-meshy-plan-is-right-for-you-free-vs-pro-vs-premium-vs-ultra)

## Optional 3D fallback research

The remaining 3D workflow applies only if sprite animation or camera requirements justify a model-based source later. It is not the next implementation milestone.

### 3D tools to consider if the fallback is needed

These are capability-based recommendations. Documentation does not establish which service will best reproduce these particular characters.

| Tool | Role in this project | Evidence and limits |
| --- | --- | --- |
| Your preferred image generator/editor | Consistent character designs, turnaround views, costume variants, portraits, paintover proposals | Judge against the existing paintings. Use reference-conditioned edits to preserve identity; manually reconcile contradictions between views. |
| **Meshy** | First candidate for an accessible image-to-mesh-to-animation workflow | Its multi-image API accepts 1–4 views and supports pose, texture, and remeshing controls. The documented model is currently `meshy-7.1`; pin versions rather than `latest`. [Multi-image API](https://docs.meshy.ai/en/api/multi-image-to-3d) |
| **Hyper3D Rodin** | Second candidate in the same character comparison | Current Gen-2.5 documentation supports image input, rest-pose conditioning, GLB output, and mesh controls. Test costume fidelity and repair effort. Do not infer animation quality from a good turntable. [Rodin documentation](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5) |
| **Tripo** | Reserve option if the first two miss the target | Documents multiview generation, mesh processing, rigging checks, rigging, and retargeting. Avoid introducing a third service until necessary. [Developer overview](https://developers.tripo3d.ai/en/docs/introduction) |
| **Blender** | Editable production source, cleanup, UVs, texture projection, rig correction, animation, baking and export | Retain the existing headless tooling. A human visual pass remains valuable for face, silhouette, weights, and cape/armor intersections. |
| **Mixamo** | Optional humanoid rigging/animation starting point | Adobe documents neutral-pose and clean-humanoid requirements, with limitations for large props and appendages. Separate weapons and deal with capes deliberately. [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) |
| **VRoid Studio** | Optional reusable anime head/body starting point if generated anatomy remains troublesome | Provides editable body, face, hair and texture tools and exports VRM. Fantasy plate armor remains additional work; VRM material behavior needs conversion or runtime support. [VRoid Studio](https://vroid.com/en/studio) |

Start in the providers' browser interfaces. Automate paid generation only after one repeatable workflow succeeds. Provider auto-rigging is a first pass: Meshy's API documentation specifically emphasizes standard humanoids with clear limbs, so do not assume the same endpoint solves horses or riders. [Meshy rigging API](https://docs.meshy.ai/en/api/rigging)

## Deferred 3D production stages and acceptance gates

### 1. Approve the model design in 2D

Create a small style sheet from the existing references, including palette, proportions, line weight, material examples, and a reduced-size tactical preview. Make Brenna the first test because face, hair, armor, cloth, and identity all matter on that asset.

Request these images for the approved candidate:

1. Full-body front A-pose with hands, legs, and boots clearly separated.
2. Matching side and back views with identical scale and costume construction.
3. Face closeup, plus separate sword and cape reference images.
4. A three-quarter tactical preview at approximately the game's camera angle.

Use separate input images for the generator, with one character per image. A contact sheet is useful for review but may be misread as multiple characters by reconstruction. Check that closures, pauldrons, belts, hair, and cape attachments agree across views. One coherent front image is preferable to contradictory multiview inputs.

**Gate:** the model-design sheet looks right at 64, 96, and 128 pixels tall and preserves Brenna's identity. Those are comparison sizes; the actual browser screenshot remains authoritative.

### 2. Run a bounded generator comparison

Give the same approved design to Meshy and Rodin. Produce two candidates per service. Save inputs, service/model versions, settings, outputs, elapsed time, and credits. First inspect silhouette, back view, underarms, hands, and geometry with neutral material. Then compare textured results under identical lighting.

Score candidates out of 100: silhouette/proportions 30, identity/costume 25, game-camera readability 20, deformation viability 15, cleanup effort 10. Reject fused arms, fused weapons, unusable faces, and unrepairable garment masses regardless of total score. Use a consistent cleanup allowance, such as two hours per finalist, to avoid comparing an extensively polished candidate with a raw export.

**Gate:** select the result with the best accepted in-game appearance per hour of work. If none passes after one reference correction and another limited round, use a reusable authored base or an artist-assisted hero mesh. Do not scale a failing generation process to the roster.

### 3. Finish a reusable production character

In Blender, correct the silhouette and reduce unnecessary detail. Keep flexible body/clothing surfaces suitable for deformation; armor may remain separate and weighted rigidly. Replace malformed hands or faces from a clean shared base when faster than repair. Separate weapons from the hands and retain a grip attachment.

Retopologize the bending regions where necessary. Automatic quad output is not proof of good elbow, shoulder, knee, or hip loops. Decimation can reduce static geometry but does not create useful deformation topology.

Establish consistent UVs and texture density. Project or bake the generated paint onto the finished mesh, then repair seams and faces. Ask AI for paintover proposals or decorative motifs; do not expect a freshly generated image to respect an existing UV atlas without projection and cleanup. Keep hard directional shadows out of the base color when the engine will light the asset.

Use one standard humanoid skeleton and attachment convention. Start with idle, walk, ready, attack, hit, and defeat clips; share locomotion while retaining weapon-specific attacks. Author or correct hands on the weapon, foot contact, and cape movement. Animate capes with a small bone chain initially. Build horse and rider separately and validate saddle height, knees, stirrups, and reins before mounted animation.

**Gate:** acceptable front/side/back views and deformation in a walk, deep elbow bend, raised arm, and attack. Preserve the `.blend` source and textures alongside reproducible export settings.

### 4. Make the imported result survive the game renderer

Modify these integration points during the first implementation slice:

| Area | Planned change |
| --- | --- |
| `src/models.js` | Add a separate versioned import path preserving texture maps, UV transforms, alpha settings, and material roles. Retain the existing model path for comparison. |
| Cloning and animation | Use the installed Three.js `SkeletonUtils.clone` for rigged instances and `AnimationMixer` for clips. The current scene clone and named rigid-part rotations are insufficient for the proposed rig. |
| Faction colors | Use a neutral-value cloth texture in a dedicated material first; add a mask if needed. Avoid tinting skin, metal, and heraldry or multiplying red over blue-painted cloth. |
| Toon materials | Preserve base-color textures when adapting materials. Share one tested shadow ramp and face treatment. Three.js supports both a color map and a nearest-filtered toon gradient. [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html) |
| Outlines | Use a skinned shell with matching weights/bind data or a compatible runtime outline technique. Evaluate silhouette continuity, internal seams, and small-screen thickness. |
| `src/main.js` | Establish a character test-lighting preset with bloom off and restrained ambient occlusion/rim light; then integrate the approved look with the map. |
| `src/portraits.js` | Add approved image portraits with the current generated portraits as fallback. Reuse the accepted character identity and palette. |
| `src/camera.js` | Preserve the current camera for controlled comparisons; evaluate framing changes separately. |

Blender shader-node networks are not generally serialized as equivalent Three.js shaders. Export supported material data and baked textures, then implement the desired light response in the runtime. [Blender glTF material documentation](https://docs.blender.org/manual/en/5.0/addons/import_export/scene_gltf2.html)

Roughness alone will not produce an illustrated look. Decide between painted/baked shading with an unlit presentation and relatively neutral painted albedo with runtime toon lighting. Avoid doubling strong baked highlights and shadows with aggressive dynamic lighting.

### 5. Validate at game scale, then expand

Use `tools/shot.mjs` to capture the same normal and close views for each candidate:

```bash
node tools/shot.mjs docs/redesign/brenna-candidate-map.png 1280 800 'select=brenna'
node tools/shot.mjs docs/redesign/brenna-candidate-close.png 1280 800 'zoom=2.6&focus=5,9&select=brenna'
node tools/shot.mjs docs/redesign/brenna-candidate-mobile.png 390 844 'select=brenna'
```

Also review side/back facings, both faction palettes, selected/unselected states, and a full map. Inspect unit selection and hover so the visual migration preserves interaction. Test motion in the browser rather than relying on stills. Add a deterministic pose/time option to the review harness when implementing it; current idle phases are randomized.

**Gate:** the user prefers the candidate to the current unit at normal gameplay size; class and faction remain recognizable; feet and weapon contact look plausible; no console errors; repeated unit instances animate independently; target-device frame time and memory remain acceptable.

Suggested initial budgets, to be revised after device profiling:

| Resource | Starting target |
| --- | --- |
| Recruit body, clothing, and gear | 8–15k exported triangles before outline shell |
| Named hero | 15–25k exported triangles before outline shell |
| Hero textures | One 2K color atlas; optional separate 512–1K face atlas |
| Recruit textures | Shared 1K atlas where practical |
| Material divisions | Aim for 2–4 main surfaces; count outline and extra passes separately |
| Animation | Shared skeleton; in-place locomotion controlled by game movement |
| Transform convention | Blender Z-up, feet at Z=0, forward -Y; exported Three.js Y-up, ground Y=0, forward +Z |
| Game size | Start at approximately the existing 1.30-unit standing height; compare proportions without changing total height |

Triangle count is only one constraint: outline shells, shadows, passes, draw calls, texture memory, and the existing supersampling all matter. Reuse geometry/textures across recruits and profile the full scene on a named target device.

## Deferred 3D production order and experiment budget

1. **Brenna prototype:** approved model sheet, provider comparison, finished mesh, runtime material/rig support, desktop/mobile review. Planning allowance: roughly 3–5 focused working days with someone able to perform Blender cleanup; this is an estimate, not a service turnaround guarantee.
2. **Reusable recruit kit:** standard body, helmet/head options, boots, gloves, tunic, cape, armor pieces, weapon sockets, faction cloth. Produce pikeman and archer from this kit. Generate only distinctive missing components.
3. **Dreg:** adapt the broader base and reuse the material/animation conventions; spend effort on beard, mantle, silhouette, and axe rather than rebuilding the pipeline.
4. **Cavalier:** separate horse/rider rigs and mounted contact review. Treat as its own milestone because it has different animation constraints.
5. **Environment alignment:** use a bridge/village/forest patch as the test scene. Reduce fine grass noise, simplify tree value groups, harmonize stone/roof palettes, restrain water highlights, and assess castle-to-unit scale. Keep procedural terrain placement and building generation where useful; use generated painted texture references or distinctive props selectively.

A useful first spending cap is **US$50–100 equivalent for a time-limited experiment**, subject to the actual plans/credits available. This is a proposed cap, not a quoted subscription or expected total production cost. Budget cleanup time explicitly.

For one transparent example, Meshy's current API table lists 30 credits for a textured 2K multiview model, 5 for rigging, and 3 per animation action. Four textured candidates plus one rig and three actions would be 134 credits before any remesh or image-generation calls. API and web subscription allowances must be checked separately. [Meshy API pricing](https://docs.meshy.ai/en/api/pricing)

## Additional records for the optional 3D workflow

Proposed source layout, to create when implementing the first asset:

```text
design_assets/characters/brenna/v01/   approved views and paintovers
art/characters/brenna/                editable Blender source and textures
art/shared/                          bodies, rig, equipment and material library
tools/assets/                        import, validate, export and review helpers
public/models/characters/brenna/      runtime GLB and texture outputs
docs/asset-reviews/                   screenshots, measurements and decision notes
```

Keep a manifest per accepted asset with source image hashes, provider/model version, prompt/settings, task ID or seed where available, original downloads, edits, rights/attribution record, exported dimensions, triangle/material counts, texture sizes, skeleton version, clips, and review captures. Preserve original generated files: re-running the same request may not reproduce them exactly. Record new third-party contributions in `CREDITS.md`.

Good agent tasks: submit bounded jobs, download/version results, normalize transforms, inspect mesh statistics, assign known material roles, export, capture turntables and browser views, flag missing files/animations, and prepare review comparisons. Use MCP for interactive inspection and targeted edits, and saved Blender scripts for repeatable transformations. Never silently regenerate an accepted character during a build.

If a service fails twice on the same anatomical feature, change the reference or replace that feature from the shared kit. If it still requires sculpting judgment, a small artist handoff to establish the first approved hero/base can be more economical than repeated prompting.

## Sprite refinement prompt, only after the first in-game review

Use `brenna_sprite.png` as the primary reference, with the original painting for identity:

> Create one game-ready tactical RPG sprite of this exact character. Preserve her mature proportions, lavender hair, ivory and gold armor, royal-blue cape, sword and blue-topped staff in the same hands. Full body in a grounded ready stance, viewed from a slightly elevated three-quarter angle consistent with the reference. Preserve the illustrated pixel-like treatment and simplify tiny filigree into readable color groups for display around 96 pixels tall. Keep the full silhouette, both boots, and all equipment inside the canvas with transparent padding. Transparent background with clean alpha edges, no ground plane, no cast shadow, no UI, no labels. Maintain the reference face, outfit, colors, and equipment. Do not enlarge the head.

Request one matching direction or pose at a time after approving the base. Specify the same canvas dimensions and foot baseline. For animation edits, describe exactly which body parts move and which remain fixed; inspect alignment rather than trusting prompt instructions alone. Generate portraits separately from the same identity so map-scale simplification does not limit portrait detail.

## Inspection record

Reviewed `GAME.md`, `CLAUDE.md`, character generation helpers, runtime models/materials, lighting, camera, portraits integration, screenshot tool, six character/mount GLBs, the original three design references, the two new sprite PNGs, and the supplied screenshot. Verified both new sprites have an alpha channel with transparent and opaque pixels. Captured the current game through the Windows Vite/Chrome setup because the installed dependencies are Windows-oriented.

- `docs/redesign/pipeline-baseline-landscape.png`: fresh 1280×800 map capture with Brenna selected.
- `docs/redesign/pipeline-baseline-closeup.png`: fresh close view for proportions/material review.

The baseline screenshots show the 3D-model game before the sprite work. Sprite integration, anatomical scaling, contact shadows, the terrain tone-down and the painted pass are recorded under **As built**; no animation test has been performed yet.
