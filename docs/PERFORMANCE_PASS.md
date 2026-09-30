# Rendering performance pass

## Changes

- Idle planning targets 30 rendered frames per second; battle playback and active camera dragging target 60. This reduces the number of complete scene and post-processing renders during planning while keeping interactions and combat at the existing cadence.
- The renderer and composer buffers cap at 1.6 million pixels. The scale is min(1, sqrt(1,600,000 / viewport CSS pixels)); it never exceeds 1. Large scenes become softer as their pixel ratio drops, while the DOM interface remains at normal browser resolution. Renderer, composer and SMAA receive the same scale on resize.
- GTAO and its denoise pass now use 8 samples instead of 16. This halves those pass sample counts; it is a quality/performance tradeoff, not a measured percentage reduction in GPU time.
- Turning Painterly off with `P` or `?paint=0` disables its composer pass. The effect-off path previously rendered a fullscreen copy shader each frame even though it did not build the sprite mask.
- Development builds expose `window.__game.renderStats`: cumulative rendered frames, renderer draw calls, triangles and JavaScript frame submission time, plus the active `pixelRatio` and `pixelBudget`. The Three.js counters are collected across the main composer and overlay renders by resetting `renderer.info` once at the start of a displayed frame. These are command/CPU-side diagnostics; they do not report hardware GPU utilization or GPU execution time.

## Three.js guidance

Three.js documents capping the drawing-buffer pixel count with a scale of `sqrt(maxPixels / currentPixels)` on large displays. Its responsive-rendering guide notes that processing many physical display pixels can raise GPU load and lower frame rates. The game applies that approach at 1.6 million pixels and caps the ratio at 1. Three.js also documents `renderer.info.autoReset = false` with an explicit per-frame `reset()` for collecting render statistics across multiple render passes. Its renderer documentation describes `shadowMap.autoUpdate = false` as suitable when shadows do not need dynamic updates. This game animates units and flags and moves units during battle playback, so its shadow map continues to refresh on each displayed frame.

`EffectComposer` executes enabled passes in sequence. Disabling the Painterly pass when its effect strength is zero skips that pass while leaving the remaining composer chain enabled. Post-processing renders scene output to intermediate targets and applies effects through subsequent passes, so sample-count reductions and fewer rendered frames directly reduce the amount of work submitted by those paths.

Sources: [Responsive rendering](https://threejs.org/manual/pages/responsive.html), [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [EffectComposer](https://threejs.org/docs/pages/EffectComposer.html), [Three.js post-processing manual](https://threejs.org/manual/pages/post-processing.html), [Three.js shadows manual](https://threejs.org/manual/pages/shadows.html).

## Verification and limits

The production build passes after the pixel cap. Browser checks pass: at 2552x1238 the backing buffer measures 1,599,896 pixels, and P/H toggles reduce submitted draw work and restore the displayed effect. High-resolution visuals and normal controls were inspected. tools/verify-performance.mjs reproduces those checks. No device-specific GPU utilization comparison was available during this pass, so these changes are supported by reduced target frame/pass work rather than a claim that the reported GPU percentage fell by a particular amount.
