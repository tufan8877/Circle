import { describe, it, expect } from "vitest";
import {
  analyseCircle,
  resamplePoints,
  fitCircle,
  getRatingLabel,
} from "@/lib/circleAnalysis";
import type { Point } from "@/lib/circleAnalysis";

// ── Helpers: generate synthetic drawings ─────────────────────────────

/** Generate a near-perfect circle of `n` points. */
function makePerfectCircle(
  cx: number,
  cy: number,
  r: number,
  n: number = 120,
  noise: number = 0,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const nx = (Math.random() - 0.5) * noise;
    const ny = (Math.random() - 0.5) * noise;
    pts.push({
      x: cx + r * Math.cos(angle) + nx,
      y: cy + r * Math.sin(angle) + ny,
    });
  }
  return pts;
}

/** Generate an ellipse (oval) — should score lower than a circle. */
function makeEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number = 120,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    pts.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return pts;
}

/** Generate a straight line. */
function makeLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  n: number = 50,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

/** Generate a half circle (semicircle). */
function makeHalfCircle(
  cx: number,
  cy: number,
  r: number,
  n: number = 80,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = Math.PI + (i / (n - 1)) * Math.PI;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

/** Generate a spiral. */
function makeSpiral(
  cx: number,
  cy: number,
  rStart: number,
  rEnd: number,
  turns: number,
  n: number = 200,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const angle = t * turns * Math.PI * 2;
    const r = rStart + (rEnd - rStart) * t;
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

/** Generate a circle drawn twice (multi-lap). */
function makeDoubleCircle(
  cx: number,
  cy: number,
  r: number,
  n: number = 240,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 4; // two full turns
    pts.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return pts;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("resamplePoints", () => {
  it("returns evenly spaced points along a line", () => {
    const pts = makeLine(0, 0, 100, 0, 11);
    const resampled = resamplePoints(pts, 5);
    expect(resampled).toHaveLength(5);
    expect(resampled[0].x).toBeCloseTo(0);
    expect(resampled[4].x).toBeCloseTo(100);
    // Check even spacing.
    const gaps = [];
    for (let i = 1; i < resampled.length; i++) {
      gaps.push(resampled[i].x - resampled[i - 1].x);
    }
    gaps.forEach((g) => expect(g).toBeCloseTo(25, 0));
  });

  it("handles single point gracefully", () => {
    expect(resamplePoints([{ x: 5, y: 5 }], 10)).toHaveLength(1);
  });
});

describe("fitCircle", () => {
  it("recovers center and radius of a perfect circle", () => {
    const pts = makePerfectCircle(200, 200, 100, 64);
    const fit = fitCircle(pts);
    expect(fit.cx).toBeCloseTo(200, 0);
    expect(fit.cy).toBeCloseTo(200, 0);
    expect(fit.r).toBeCloseTo(100, 0);
  });
});

describe("analyseCircle", () => {
  it("gives a high score to a near-perfect circle", () => {
    const pts = makePerfectCircle(300, 300, 150, 200, 1.0);
    const result = analyseCircle(pts);
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(90);
  });

  it("gives a lower score to an ellipse", () => {
    const circle = analyseCircle(makePerfectCircle(300, 300, 150, 200));
    const ellipse = analyseCircle(makeEllipse(300, 300, 200, 100, 200));
    expect(ellipse.valid).toBe(true);
    expect(ellipse.score).toBeLessThan(circle.score);
    expect(ellipse.score).toBeLessThan(90);
  });

  it("rejects a straight line", () => {
    const pts = makeLine(50, 200, 550, 200, 100);
    const result = analyseCircle(pts);
    expect(result.valid).toBe(false);
  });

  it("rejects a half circle (incomplete)", () => {
    const pts = makeHalfCircle(300, 300, 150, 100);
    const result = analyseCircle(pts);
    expect(result.valid).toBe(false);
    expect(result.invalidReason).toContain("full circle");
  });

  it("gives a low score to a spiral", () => {
    const pts = makeSpiral(300, 300, 20, 150, 3, 300);
    const result = analyseCircle(pts);
    expect(result.score).toBeLessThan(50);
  });

  it("rejects multiple laps", () => {
    const single = analyseCircle(makePerfectCircle(300, 300, 150, 200));
    const double = analyseCircle(makeDoubleCircle(300, 300, 150, 300));
    expect(double.valid).toBe(false);
    expect(double.score).toBeLessThan(single.score);
  });

  it("is deterministic — same input gives same output", () => {
    const pts = makePerfectCircle(250, 250, 120, 180);
    const r1 = analyseCircle(pts);
    const r2 = analyseCircle(pts);
    expect(r1.score).toBe(r2.score);
  });

  it("rejects too few points", () => {
    const pts = [
      { x: 100, y: 100 },
      { x: 101, y: 101 },
    ];
    const result = analyseCircle(pts);
    expect(result.valid).toBe(false);
  });

  it("rejects extremely small drawings", () => {
    const pts = makePerfectCircle(10, 10, 5, 80);
    const result = analyseCircle(pts);
    expect(result.valid).toBe(false);
  });

  it("is resolution-independent — same shape, different scale", () => {
    const small = makePerfectCircle(150, 150, 80, 200);
    const large = makePerfectCircle(600, 600, 320, 200);
    const r1 = analyseCircle(small);
    const r2 = analyseCircle(large);
    // Scores should be very close (within 2%).
    expect(Math.abs(r1.score - r2.score)).toBeLessThan(2);
  });

  it("is speed-independent — same shape, different point density", () => {
    const sparse = makePerfectCircle(300, 300, 150, 100);
    const dense = makePerfectCircle(300, 300, 150, 500);
    const r1 = analyseCircle(sparse);
    const r2 = analyseCircle(dense);
    expect(Math.abs(r1.score - r2.score)).toBeLessThan(5);
  });

  it("never exceeds 100%", () => {
    const pts = makePerfectCircle(300, 300, 150, 500, 0);
    const result = analyseCircle(pts);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("never goes below 0%", () => {
    const pts = makeSpiral(300, 300, 10, 200, 5, 500);
    const result = analyseCircle(pts);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("getRatingLabel", () => {
  it("returns 'Perfect circle!' for 100", () => {
    expect(getRatingLabel(100).label).toBe("Perfect circle!");
  });
  it("returns 'Almost perfect' for 97–99.9", () => {
    expect(getRatingLabel(98).label).toBe("Almost perfect");
  });
  it("returns 'Amazing' for 90–96.9", () => {
    expect(getRatingLabel(93).label).toBe("Amazing");
  });
  it("returns 'Great circle' for 80–89.9", () => {
    expect(getRatingLabel(85).label).toBe("Great circle");
  });
  it("returns 'Good circle' for 60–79.9", () => {
    expect(getRatingLabel(70).label).toBe("Good circle");
  });
  it("returns 'Not bad' for 40–59.9", () => {
    expect(getRatingLabel(50).label).toBe("Not bad");
  });
  it("returns 'Keep practicing' for 0–39.9", () => {
    expect(getRatingLabel(20).label).toBe("Keep practicing");
  });
});

// Polygon validation must be independent of position, size and direction.
function makePolygon(vertices: Point[], bowed = false): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    for (let j = 0; j < 80; j++) {
      const t = j / 80;
      const offset = bowed ? Math.sin(t * Math.PI) * 3 : 0;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      result.push({
        x: a.x + (b.x - a.x) * t - (b.y - a.y) / length * offset,
        y: a.y + (b.y - a.y) * t + (b.x - a.x) / length * offset,
      });
    }
  }
  result.push(vertices[0]);
  return result;
}

describe("polygon rejection", () => {
  const triangle = [{x: 300, y: 80}, {x: 480, y: 450}, {x: 100, y: 450}];
  const square = [{x: 100, y: 100}, {x: 400, y: 100}, {x: 400, y: 400}, {x: 100, y: 400}];
  for (const [name, vertices] of [["triangle", triangle], ["square", square]] as const) {
    for (const bowed of [false, true]) {
      it(`rejects ${name} with ${bowed ? "slightly curved" : "straight"} sides`, () => {
        const result = analyseCircle(makePolygon(vertices, bowed));
        expect(result.valid).toBe(false);
        expect(result.score).toBe(0);
        expect(result.invalidReason).toContain("corners");
      });
    }
  }
  it("rejects a rotated scaled triangle drawn backwards with a small gap", () => {
    const points = makePolygon(triangle).map(p => ({x: 700 + (p.x-p.y)*0.6, y: 100 + (p.x+p.y)*0.6})).reverse().slice(5);
    expect(analyseCircle(points).valid).toBe(false);
  });
  it("accepts a wobbly round circle", () => {
    const points = Array.from({length: 240}, (_, i) => {
      const angle = i / 239 * 2 * Math.PI;
      const radius = 150 * (1 + 0.08 * Math.sin(3 * angle) + 0.025 * Math.cos(7 * angle));
      return {x: 300 + radius * Math.cos(angle), y: 300 + radius * Math.sin(angle)};
    });
    expect(analyseCircle(points).valid).toBe(true);
  });
});

describe('circle validation regressions', () => {
  function arc(turns: number, n = 200): Point[] {
    return Array.from({length: n}, (_, i) => {
      const a = i / (n - 1) * Math.PI * 2 * turns;
      return {x: 300 + 150 * Math.cos(a), y: 300 + 150 * Math.sin(a)};
    });
  }
  it.each([0.75, 5 / 6, 11 / 12, 1.5, 2, 3])('rejects open or repeated circle with %s turns', turns => {
    const result = analyseCircle(arc(turns));
    expect(result.valid).toBe(false);
    expect(result.score).toBe(0);
  });
  it('allows a small natural closing gap', () => {
    expect(analyseCircle(arc(0.985)).valid).toBe(true);
  });
  it('rejects a one-turn spiral', () => {
    const spiral = arc(1).map((p, i) => {
      const factor = (80 + 80 * i / 199) / 150;
      return {x: 300 + (p.x - 300) * factor, y: 300 + (p.y - 300) * factor};
    });
    expect(analyseCircle(spiral).valid).toBe(false);
  });
  it.each([3, 4, 5, 6, 7, 8])('rejects a %s-sided shape with hand tremor', sides => {
    const vertices = Array.from({length: sides}, (_, i) => {
      const a = i / sides * Math.PI * 2;
      return {x: 300 + 150 * Math.cos(a), y: 300 + 150 * Math.sin(a)};
    });
    const points = makePolygon(vertices).map((p, i) => ({x: p.x + 2 * Math.sin(i * 3.1), y: p.y + 2 * Math.cos(i * 2.7)}));
    expect(analyseCircle(points).valid).toBe(false);
  });
  it.each([20, 30, 100, 200, 500])('accepts a circle sampled at %s points', n => {
    const result = analyseCircle(arc(1, n));
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(98);
  });
  it('does not change score when the same polyline is sampled more densely', () => {
    const points = arc(1, 40);
    const dense = points.flatMap((a, i) => {
      if (i === points.length - 1) return [a];
      const b = points[i + 1];
      const count = i < 15 ? 20 : 1;
      return Array.from({length: count}, (_, j) => ({x: a.x + (b.x - a.x) * j / count, y: a.y + (b.y - a.y) * j / count}));
    });
    expect(analyseCircle(points).score).toBe(analyseCircle(dense).score);
  });
  it('is stable for translated coordinates', () => {
    const points = arc(1);
    expect(analyseCircle(points.map(p => ({x: p.x + 1000000, y: p.y + 1000000}))).score).toBe(analyseCircle(points).score);
  });
  it('returns finite zero scores for invalid coordinates and empty input', () => {
    for (const points of [[], [{x: NaN, y: 0}], [{x: Infinity, y: 0}]]) {
      const result = analyseCircle(points);
      expect(result.valid).toBe(false);
      expect(result.score).toBe(0);
      expect(Number.isFinite(result.fit.r)).toBe(true);
    }
  });
});
