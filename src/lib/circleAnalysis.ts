/**
 * Circle Analysis Module
 * =======================
 * Evaluates a freehand-drawn circle and returns a score from 0 to 100%.
 *
 * Pipeline:
 *  1. Resample the raw points to evenly spaced arc-length samples.
 *  2. Least-squares circle fit (algebraic Kåsa method) → center & radius.
 *  3. Score components:
 *       a. Radius uniformity   — standard deviation of point-to-center distances.
 *       b. Closure             — distance between start and end points.
 *       c. Circularity         — ratio of perimeter² to area (isoperimetric quotient).
 *       d. Completeness        — angular coverage via unwrapped angles.
 *       e. Lap count           — penalise going round more than once.
 *       f. Back-and-forth      — detect zig-zag drawing.
 *       g. Size guard          — reject drawings that are too small.
 *  4. Combine into a single 0–100 percentage.
 *
 * The same input always yields the same output (deterministic, no randomness).
 */

export interface Point {
  x: number;
  y: number;
}

export interface CircleFit {
  cx: number;
  cy: number;
  r: number;
}

export interface AnalysisResult {
  /** Final score 0–100 with one decimal implied (e.g. 97.6). */
  score: number;
  /** Whether the attempt is valid (invalid attempts are rejected). */
  valid: boolean;
  /** Human-readable reason if invalid. */
  invalidReason?: string;
  /** Fitted circle. */
  fit: CircleFit;
  /** Individual sub-scores 0–1 for debugging/display. */
  components: {
    radiusUniformity: number;
    closure: number;
    circularity: number;
    completeness: number;
    lapPenalty: number;
    smoothness: number;
  };
  /** Number of points after resampling. */
  sampledPointCount: number;
  /** Total angular coverage in radians (0 = no rotation, 2π = one full lap). */
  totalAngle: number;
  /** Number of full laps detected. */
  laps: number;
}

// ─── Constants ────────────────────────────────────────────────────────

/** Minimum number of raw points to attempt analysis. */
const MIN_RAW_POINTS = 10;
/** Target number of evenly-spaced samples after resampling. */
const RESAMPLE_COUNT = 256;
/** Minimum bounding-box diagonal (in CSS px) to be considered a real drawing. */
const MIN_SIZE = 60;
/** Numerical tolerance for a "perfect" circle. */
const PERFECT_TOLERANCE = 0.0005;
/** Angular coverage required for a full circle (radians). */
const FULL_CIRCLE_ANGLE = Math.PI * 2;
/** Tolerance fraction for closure — gap vs radius. */
const CLOSURE_TOLERANCE = 0.15;

// ─── 1. Resampling ───────────────────────────────────────────────────

/**
 * Resample the polyline to `count` evenly spaced points along its arc length.
 * This prevents dense clusters of points from skewing the analysis.
 */
export function resamplePoints(points: Point[], count: number): Point[] {
  if (points.length < 2) return [...points];

  // Compute cumulative arc lengths.
  const dists: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }
  const totalLength = dists[dists.length - 1];
  if (totalLength === 0) return [points[0]];

  const result: Point[] = [points[0]];
  const step = totalLength / (count - 1);
  let segIdx = 0;

  for (let i = 1; i < count - 1; i++) {
    const target = step * i;
    // Advance segment pointer.
    while (segIdx < dists.length - 2 && dists[segIdx + 1] < target) {
      segIdx++;
    }
    const segStart = dists[segIdx];
    const segEnd = dists[segIdx + 1];
    const segLen = segEnd - segStart;
    const t = segLen === 0 ? 0 : (target - segStart) / segLen;
    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];
    result.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

// ─── 2. Least-Squares Circle Fit (Kåsa method) ───────────────────────

/**
 * Fit a circle to points using the algebraic least-squares Kåsa method.
 * Solves the linear system:
 *   [ Σx²  Σxy  Σx ] [ a ]   [ Σ(x² + y²) ]
 *   [ Σxy  Σy²  Σy ] [ b ] = [ Σy(x² + y²) ]
 *   [ Σx   Σy   n  ] [ c ]   [ Σ(x² + y²) ]  (simplified)
 *
 * Center = (a/2, b/2), radius = sqrt(c + a²/4 + b²/4)
 */
export function fitCircle(points: Point[]): CircleFit {
  if (points.length === 0) return {cx: 0, cy: 0, r: 0};
  // Center the coordinates to avoid cancellation in the normal equations.
  const originX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const originY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let sumX = 0, sumY = 0;
  let sumX2 = 0, sumY2 = 0, sumXY = 0;
  let sumX3 = 0, sumY3 = 0, sumXY2 = 0, sumX2Y = 0;
  const n = points.length;

  for (const p of points) {
    const x = p.x - originX, y = p.y - originY;
    const x2 = x * x, y2 = y * y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += x * y;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumXY2 += x * y2;
    sumX2Y += x2 * y;
  }

  // Build the normal equations matrix (3x3) and solve via Cramer's rule.
  const A = [
    [sumX2, sumXY, sumX],
    [sumXY, sumY2, sumY],
    [sumX, sumY, n],
  ];
  const b = [
    -(sumX3 + sumXY2),
    -(sumX2Y + sumY3),
    -(sumX2 + sumY2),
  ];

  const det = det3(A);
  if (Math.abs(det) < 1e-12) {
    // Degenerate — return centroid with zero radius.
    return { cx: originX + sumX / n, cy: originY + sumY / n, r: 0 };
  }

  const a = det3(replaceCol(A, 0, b)) / det;
  const bb = det3(replaceCol(A, 1, b)) / det;
  const c = det3(replaceCol(A, 2, b)) / det;

  const cx = -a / 2;
  const cy = -bb / 2;
  const r = Math.sqrt(Math.max(0, (a * a + bb * bb) / 4 - c));
  return { cx: cx + originX, cy: cy + originY, r };
}

function det3(m: number[][]): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

function replaceCol(m: number[][], col: number, v: number[]): number[][] {
  return m.map((row, i) => row.map((val, j) => (j === col ? v[i] : val)));
}

// ─── 3a. Radius Uniformity ───────────────────────────────────────────

/**
 * Measures how consistently all points are at the fitted radius from center.
 * Returns a score 0–1 where 1 = perfect uniformity.
 * Uses the coefficient of variation of distances.
 */
function scoreRadiusUniformity(points: Point[], fit: CircleFit): number {
  if (fit.r === 0) return 0;
  const dists = points.map((p) => Math.hypot(p.x - fit.cx, p.y - fit.cy));
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  if (mean === 0) return 0;
  const variance =
    dists.reduce((a, d) => a + (d - mean) ** 2, 0) / dists.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean; // coefficient of variation
  // Map: cv=0 → 1, cv=0.3 → ~0. Use exponential.
  return Math.max(0, Math.exp(-cv * 5));
}

// ─── 3b. Closure ──────────────────────────────────────────────────────

/**
 * Measures how close the start and end points are relative to the radius.
 * Returns 0–1 where 1 = perfectly closed.
 */
function scoreClosure(points: Point[], fit: CircleFit): number {
  const start = points[0];
  const end = points[points.length - 1];
  const gap = Math.hypot(end.x - start.x, end.y - start.y);
  if (fit.r === 0) return 0;
  const ratio = gap / fit.r;
  // ratio=0 → 1; larger endpoint gaps reduce the closure score.
  if (ratio <= 0.02) return 1;
  return Math.max(0, 1 - (ratio / CLOSURE_TOLERANCE) ** 1.5);
}

// ─── 3c. Circularity (isoperimetric quotient) ────────────────────────

/**
 * Uses the isoperimetric quotient: 4πA / P².
 * A perfect circle = 1. Returns 0–1.
 * Area computed via the shoelace formula on the sampled polygon.
 */
function scoreCircularity(points: Point[]): number {
  const area = Math.abs(polygonArea(points));
  const perimeter = polygonPerimeter(points);
  if (perimeter === 0) return 0;
  const iq = (4 * Math.PI * area) / (perimeter * perimeter);
  return Math.max(0, Math.min(1, iq));
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

function polygonPerimeter(points: Point[]): number {
  let perim = 0;
  for (let i = 0; i < points.length - 1; i++) {
    perim += Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y,
    );
  }
  // Area closes the polygon too: perimeter must include that same edge.
  if (points.length > 1) {
    perim += Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  }
  return perim;
}

// ─── 3d. Completeness (angular coverage with unwrapping) ─────────────

/**
 * Computes the total angular sweep around the fitted center using
 * angle unwrapping. A full circle ≈ 2π.
 * Returns { totalAngle, laps }.
 */
function angularCoverage(points: Point[], fit: CircleFit): {
  totalAngle: number;
  laps: number;
} {
  if (points.length < 2) return { totalAngle: 0, laps: 0 };

  // Compute raw angles relative to center.
  const angles = points.map((p) =>
    Math.atan2(p.y - fit.cy, p.x - fit.cx),
  );

  // Unwrap: accumulate deltas, adjusting for 2π jumps.
  let total = 0;
  for (let i = 1; i < angles.length; i++) {
    let delta = angles[i] - angles[i - 1];
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    total += delta;
  }

  const totalAngle = Math.abs(total);
  const laps = totalAngle / FULL_CIRCLE_ANGLE;
  return { totalAngle, laps };
}

/**
 * Scores completeness: 1.0 when angular coverage is exactly 2π,
 * decreasing for partial or excessive coverage.
 */
function scoreCompleteness(totalAngle: number): number {
  const ratio = totalAngle / FULL_CIRCLE_ANGLE;
  if (ratio < 0.5) return 0;
  // Peak at ratio=1, drop off for <1 (incomplete) and >1.15 (overdraw)
  if (ratio <= 1.0) {
    // 0.5→0, 1.0→1
    return Math.max(0, (ratio - 0.5) / 0.5);
  }
  // >1: gentle decay until 1.5 → 0
  if (ratio <= 1.5) {
    return Math.max(0, 1 - (ratio - 1) / 0.5 * 0.5);
  }
  return 0;
}

// ─── 3e. Lap penalty ─────────────────────────────────────────────────

/**
 * Penalises drawing more than one full lap.
 * 1 lap → 1.0, 1.5 laps → ~0.7, 2+ laps → ~0.3
 */
function lapPenalty(laps: number): number {
  if (laps <= 1.05) return 1;
  if (laps <= 1.5) return 1 - (laps - 1.05) * 0.6;
  if (laps <= 2.0) return 0.73 - (laps - 1.5) * 0.8;
  return Math.max(0.1, 0.33 - (laps - 2) * 0.1);
}

// ─── 3f. Smoothness (back-and-forth detection) ───────────────────────

/**
 * Detects zig-zag drawing by checking how often the angular direction
 * reverses. A smooth circle has a monotonic angle progression.
 * Returns 0–1 where 1 = perfectly smooth (no reversals).
 */
function scoreSmoothness(points: Point[], fit: CircleFit): number {
  if (points.length < 3) return 0;
  const angles = points.map((p) =>
    Math.atan2(p.y - fit.cy, p.x - fit.cx),
  );

  // Compute unwrapped angular deltas.
  const deltas: number[] = [];
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    deltas.push(d);
  }

  // Count sign changes (direction reversals).
  let signChanges = 0;
  let prevSign = 0;
  for (const d of deltas) {
    const sign = Math.sign(d);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      signChanges++;
    }
    if (sign !== 0) prevSign = sign;
  }

  // Normalise by the number of segments — a few reversals on a noisy
  // circle are fine, but constant zig-zag is bad.
  const reversalRate = signChanges / deltas.length;
  return Math.max(0, 1 - reversalRate * 4);
}

/**
 * Canonical ordering of a closed polyline makes arc-length sampling
 * independent of the supplied starting vertex and drawing direction.
 * Open strokes retain their endpoints for closure validation.
 */
function canonicalStroke(points: Point[]): Point[] {
  const first = points[0], last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-7) return points;
  let ring = points.slice(0, -1);
  if (polygonArea(ring) < 0) ring = ring.reverse();
  let start = 0;
  for (let i = 1; i < ring.length; i++) {
    if (ring[i].x < ring[start].x || (ring[i].x === ring[start].x && ring[i].y < ring[start].y)) start = i;
  }
  ring = [...ring.slice(start), ...ring.slice(0, start)];
  return [...ring, ring[0]];
}

/**
 * Classification uses the convex envelope to tolerate hand tremor.
 * Scoring still uses the original, unsmoothed arc-length samples.
 * Simplify both halves, then remove redundant vertices across the seams:
 * a stroke starting halfway along a side must not add a polygon corner.
 * Eight or fewer substantial sides count as an angular shape. This is
 * an explicit gameplay threshold, not a universal shape recognizer.
 */
function isAngularShape(points: Point[], radius: number): boolean {
  // The convex envelope removes small inward/outward tremor along sides.
  // It is used only for classification, never to improve a player's score.
  const smooth = convexHull(points);
  if (smooth.length < 3) return true;
  const first = smooth[0];
  let split = 1, farthest = 0;
  for (let i = 1; i < smooth.length; i++) {
    const distance = Math.hypot(smooth[i].x - first.x, smooth[i].y - first.y);
    if (distance > farthest) {farthest = distance; split = i;}
  }
  const tolerance = radius * 0.06;
  const closed = [...smooth, first];
  const vertices = [
    ...simplifyStroke(closed.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplifyStroke(closed.slice(split), tolerance).slice(0, -1),
  ];
  let changed = true;
  while (changed && vertices.length > 3) {
    changed = false;
    for (let i = 0; i < vertices.length; i++) {
      const a = vertices[(i - 1 + vertices.length) % vertices.length];
      const b = vertices[(i + 1) % vertices.length];
      if (pointSegmentDistance(vertices[i], a, b) <= tolerance) {
        vertices.splice(i, 1); changed = true; break;
      }
    }
  }
  return vertices.length <= 8;
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: Point[] = [], upper: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function simplifyStroke(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;
  const a = points[0], b = points[points.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  let maxDistance = 0, split = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
    const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (distance > maxDistance) {maxDistance = distance; split = i;}
  }
  if (maxDistance <= tolerance) return [a, b];
  return [...simplifyStroke(points.slice(0, split + 1), tolerance).slice(0, -1), ...simplifyStroke(points.slice(split), tolerance)];
}

// ─── 4. Combine ──────────────────────────────────────────────────────

/**
 * Analyse a raw drawing and return the final score.
 *
 * Weighted combination:
 *   radiusUniformity  35%  — most important: is every point at the same distance?
 *   circularity       20%  — is the overall shape a circle (not oval/square)?
 *   completeness      15%  — did we go all the way around?
 *   closure           15%  — did we close the loop?
 *   smoothness        10%  — was the drawing smooth (no zig-zag)?
 *   lapPenalty        5%   — did we go around exactly once?
 *
 * Final score = weightedSum * 100, clamped to [0, 100].
 * 100% only achievable when all components are ~1 within numerical tolerance.
 */
export function analyseCircle(rawPoints: Point[]): AnalysisResult {
  // ── Guards ──
  if (rawPoints.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return invalidResult([], "Could not fit a circle.");
  }
  if (rawPoints.length < MIN_RAW_POINTS) {
    return invalidResult(rawPoints, "Too few points to analyse.");
  }

  // Bounding box size check.
  const bb = boundingBox(rawPoints);
  const diag = Math.hypot(bb.maxX - bb.minX, bb.maxY - bb.minY);
  if (diag < MIN_SIZE) {
    return invalidResult(rawPoints, "Drawing is too small.");
  }

  // Check for a straight line (near-zero area bounding box aspect or degenerate).
  const w = bb.maxX - bb.minX;
  const h = bb.maxY - bb.minY;
  if (w < 2 || h < 2) {
    return invalidResult(rawPoints, "Drawing is too linear.");
  }

  // ── Resample ──
  const pts = resamplePoints(canonicalStroke(rawPoints), RESAMPLE_COUNT);

  // ── Fit circle ──
  const fit = fitCircle(pts);
  if (fit.r === 0) {
    return invalidResult(rawPoints, "Could not fit a circle.");
  }

  // ── Angular coverage ──
  const { totalAngle, laps } = angularCoverage(pts, fit);

  // A valid attempt must make approximately one turn and close the loop.
  // Allow a little overshoot/undershoot, but never score multiple laps.
  if (laps > 1.08) {
    return invalidResult(rawPoints, "Too many rotations detected.");
  }
  const start = pts[0], end = pts[pts.length - 1];
  const gapRatio = Math.hypot(end.x - start.x, end.y - start.y) / fit.r;
  if (laps < 0.94 || gapRatio > 0.25) {
    return invalidResult(rawPoints, "The drawing doesn't complete a full circle.");
  }
  if (isAngularShape(pts, fit.r)) {
    return invalidResult(rawPoints, "This shape has straight sides and corners. Draw a round circle.");
  }

  // ── Sub-scores ──
  return buildResult(pts, fit, totalAngle, laps);
}

function buildResult(
  pts: Point[],
  fit: CircleFit,
  totalAngle: number,
  laps: number,
): AnalysisResult {
  const radiusUniformity = scoreRadiusUniformity(pts, fit);
  const closure = scoreClosure(pts, fit);
  const circularity = scoreCircularity(pts);
  const completeness = scoreCompleteness(totalAngle);
  const lap = lapPenalty(laps);
  const smoothness = scoreSmoothness(pts, fit);

  const weights = {
    radiusUniformity: 0.35,
    circularity: 0.2,
    completeness: 0.15,
    closure: 0.15,
    smoothness: 0.1,
    lap: 0.05,
  };

  const weighted =
    radiusUniformity * weights.radiusUniformity +
    circularity * weights.circularity +
    completeness * weights.completeness +
    closure * weights.closure +
    smoothness * weights.smoothness +
    lap * weights.lap;

  let score = weighted * 100;

  // 100% only within numerical tolerance of perfection.
  if (score >= 100 - PERFECT_TOLERANCE * 100) {
    // Check if truly perfect: all components must be ~1.
    const allPerfect =
      radiusUniformity > 1 - PERFECT_TOLERANCE &&
      circularity > 1 - PERFECT_TOLERANCE &&
      completeness > 1 - PERFECT_TOLERANCE &&
      closure > 1 - PERFECT_TOLERANCE;
    score = allPerfect ? 100 : Math.min(99.9, score);
  }

  score = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;

  return {
    score,
    valid: true,
    fit,
    components: {
      radiusUniformity,
      closure,
      circularity,
      completeness,
      lapPenalty: lap,
      smoothness,
    },
    sampledPointCount: pts.length,
    totalAngle,
    laps,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function boundingBox(points: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function invalidResult(rawPoints: Point[], reason: string): AnalysisResult {
  const fit = fitCircle(rawPoints.length > 2 ? resamplePoints(rawPoints, Math.min(rawPoints.length, 50)) : rawPoints);
  const { totalAngle, laps } = angularCoverage(
    rawPoints.length > 2 ? rawPoints : [rawPoints[0] ?? { x: 0, y: 0 }],
    fit,
  );
  return {
    score: 0,
    valid: false,
    invalidReason: reason,
    fit,
    components: {
      radiusUniformity: 0,
      closure: 0,
      circularity: 0,
      completeness: 0,
      lapPenalty: 0,
      smoothness: 0,
    },
    sampledPointCount: rawPoints.length,
    totalAngle,
    laps,
  };
}

// ─── Rating label ────────────────────────────────────────────────────

export function getRatingLabel(score: number): {
  label: string;
  subtitle: (isNewBest: boolean) => string;
} {
  if (score >= 100) {
    return {
      label: "Perfect circle!",
      subtitle: () => "You drew a mathematically perfect circle. Inhuman.",
    };
  }
  if (score >= 97) {
    return {
      label: "Almost perfect",
      subtitle: (best) =>
        best
          ? "Your circle is better than your previous attempt!"
          : "Incredibly precise — just a hair off perfection.",
    };
  }
  if (score >= 90) {
    return {
      label: "Amazing",
      subtitle: (best) =>
        best
          ? "Your circle is better than your previous attempt!"
          : "Outstanding control — barely any wobble.",
    };
  }
  if (score >= 80) {
    return {
      label: "Great circle",
      subtitle: (best) =>
        best
          ? "Your circle is better than your previous attempt!"
          : "A strong, confident circle.",
    };
  }
  if (score >= 60) {
    return {
      label: "Good circle",
      subtitle: () => "A solid attempt with room to improve.",
    };
  }
  if (score >= 40) {
    return {
      label: "Not bad",
      subtitle: () => "Getting there — try to close the circle more evenly.",
    };
  }
  return {
    label: "Keep practicing",
    subtitle: () => "Every great circle starts with a wobbly one.",
  };
}

export function getScoreColor(score: number): string {
  if (score >= 97) return "#34d399"; // emerald-400
  if (score >= 90) return "#22d3ee"; // cyan-400
  if (score >= 80) return "#60a5fa"; // blue-400
  if (score >= 60) return "#fbbf24"; // amber-400
  if (score >= 40) return "#fb923c"; // orange-400
  return "#f87171"; // red-400
}
