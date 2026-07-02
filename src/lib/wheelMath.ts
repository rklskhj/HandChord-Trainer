/**
 * Wheel geometry: segment 0 starts at the top (12 o'clock) and segments
 * are laid out clockwise. All angle math is expressed as "degrees
 * clockwise from top" (0 = top, 90 = right, 180 = bottom, 270 = left)
 * so that drawing code and hit-testing code share one convention.
 */

export function angleFromTop(dx: number, dy: number): number {
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
}

export function canvasAngleRad(angleFromTopDeg: number): number {
  return ((angleFromTopDeg - 90) * Math.PI) / 180;
}

/**
 * Given a point offset (dx, dy) from the wheel center and the number of
 * segments, returns the segment index the point falls into, or null if
 * the point is inside the inner "OFF" radius.
 */
export function pickSegment(
  dx: number,
  dy: number,
  segmentCount: number,
  innerRadius: number
): number | null {
  if (segmentCount <= 0) return null;
  const r = Math.hypot(dx, dy);
  if (r <= innerRadius) return null;
  const seg = 360 / segmentCount;
  const deg = angleFromTop(dx, dy);
  return Math.floor(deg / seg) % segmentCount;
}
