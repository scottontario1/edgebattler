// Pure camera maths: where the board goes inside the part of the screen the HUD leaves free.
// Kept free of Phaser so it can be unit-tested; CameraRig applies the results.

/** Screen rectangle left over after HUD insets { top, right, bottom, left }. Never smaller than 1px. */
export function freeRect(viewW, viewH, insets = {}) {
  const left = insets.left ?? 0;
  const top = insets.top ?? 0;
  const right = insets.right ?? 0;
  const bottom = insets.bottom ?? 0;
  const w = Math.max(1, viewW - left - right);
  const h = Math.max(1, viewH - top - bottom);
  return { x: left, y: top, w, h, cx: left + w / 2, cy: top + h / 2 };
}

/** Largest zoom at which the whole board (plus a screen-pixel margin) fits the free rectangle. */
export function fitZoom(free, boardW, boardH, margin = 12) {
  const zx = Math.max(1, free.w - margin * 2) / boardW;
  const zy = Math.max(1, free.h - margin * 2) / boardH;
  return Math.min(zx, zy);
}

/** Allowed zoom range for a board: a little wider than fit, up to a close-up cap. */
export function zoomLimits(fit, { out = 0.8, maxZoom = 2.4 } = {}) {
  const min = fit * out;
  return { min, max: Math.max(maxZoom, fit) };
}

/**
 * Camera centre (world coordinates) that makes world point `focus` appear at the middle of the free
 * rectangle. Phaser keeps the world point at the viewport centre fixed under zoom, so this is how a
 * camera with a given zoom is placed.
 */
export function cameraCenterFor(focus, zoom, free, viewW, viewH) {
  return {
    x: focus.x + (viewW / 2 - free.cx) / zoom,
    y: focus.y + (viewH / 2 - free.cy) / zoom,
  };
}

/** Keep the focus point within the board so the player can never pan the map entirely off-screen. */
export function clampFocus(focus, boardW, boardH, zoom, free) {
  // Allow the board edge to reach the middle of the free area, but not past it, when zoomed in.
  const halfW = free.w / 2 / zoom;
  const halfH = free.h / 2 / zoom;
  const slackX = Math.max(0, boardW / 2 - halfW) + boardW * 0.1;
  const slackY = Math.max(0, boardH / 2 - halfH) + boardH * 0.1;
  return {
    x: Math.min(boardW / 2 + slackX, Math.max(boardW / 2 - slackX, focus.x)),
    y: Math.min(boardH / 2 + slackY, Math.max(boardH / 2 - slackY, focus.y)),
  };
}

/** Zoom that keeps the world point under a screen point fixed (wheel and pinch zoom). */
export function focusAfterZoom(worldPoint, screenPoint, zoom, free) {
  // The point should stay at screenPoint; solve for the focus (what sits at the free-rect middle).
  return {
    x: worldPoint.x + (free.cx - screenPoint.x) / zoom,
    y: worldPoint.y + (free.cy - screenPoint.y) / zoom,
  };
}
