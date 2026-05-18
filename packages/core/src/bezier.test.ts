import { describe, expect, it } from 'vitest';
import { bezierPath, type Point } from './bezier.js';
import { createRng } from './rng.js';

const start: Point = { x: 0, y: 0 };
const end: Point = { x: 800, y: 600 };

function maxDeviationFromLine(path: readonly Point[]): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let maxDistance = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const t = i / (path.length - 1);
    const lineX = start.x + t * dx;
    const lineY = start.y + t * dy;
    const point = path[i];
    if (point === undefined) continue;
    const distance = Math.hypot(point.x - lineX, point.y - lineY);
    if (distance > maxDistance) maxDistance = distance;
  }
  return maxDistance;
}

describe('bezierPath', () => {
  describe('endpoints', () => {
    it('starts exactly at `start`', () => {
      const path = bezierPath(start, end, createRng('endpoints'), { curvature: 0.4 });
      expect(path[0]).toEqual(start);
    });

    it('ends exactly at `end`', () => {
      const path = bezierPath(start, end, createRng('endpoints'), { curvature: 0.4 });
      expect(path[path.length - 1]).toEqual(end);
    });
  });

  describe('length', () => {
    it('returns 26 points by default (steps = 25)', () => {
      const path = bezierPath(start, end, createRng('length'), { curvature: 0.4 });
      expect(path.length).toBe(26);
    });

    it('returns steps + 1 points for an explicit `steps`', () => {
      const path = bezierPath(start, end, createRng('length-custom'), {
        curvature: 0.4,
        steps: 50,
      });
      expect(path.length).toBe(51);
    });
  });

  describe('determinism', () => {
    it('produces identical paths for identical seeds', () => {
      const path1 = bezierPath(start, end, createRng('seed-a'), { curvature: 0.5 });
      const path2 = bezierPath(start, end, createRng('seed-a'), { curvature: 0.5 });
      expect(path1).toEqual(path2);
    });

    it('produces different interior points for different seeds', () => {
      const path1 = bezierPath(start, end, createRng('seed-a'), { curvature: 0.5 });
      const path2 = bezierPath(start, end, createRng('seed-b'), { curvature: 0.5 });
      // Endpoints are still exact, but interior points should differ.
      expect(path1[10]).not.toEqual(path2[10]);
    });
  });

  describe('curvature', () => {
    it('produces an exact straight line when curvature is 0', () => {
      const path = bezierPath(start, end, createRng('straight'), { curvature: 0 });
      for (let i = 0; i < path.length; i++) {
        const t = i / (path.length - 1);
        const expectedX = start.x + t * (end.x - start.x);
        const expectedY = start.y + t * (end.y - start.y);
        const point = path[i];
        expect(point?.x).toBeCloseTo(expectedX, 6);
        expect(point?.y).toBeCloseTo(expectedY, 6);
      }
    });

    it('produces larger deviations from the line as curvature grows', () => {
      const subtle = bezierPath(start, end, createRng('curve'), { curvature: 0.1 });
      const dramatic = bezierPath(start, end, createRng('curve'), { curvature: 0.9 });
      expect(maxDeviationFromLine(dramatic)).toBeGreaterThan(maxDeviationFromLine(subtle));
    });
  });

  describe('edge cases', () => {
    it('handles zero-distance movement (start === end)', () => {
      const path = bezierPath(start, start, createRng('zero-distance'), { curvature: 0.4 });
      expect(path[0]).toEqual(start);
      expect(path[path.length - 1]).toEqual(start);
      for (const point of path) {
        expect(point.x).toBeCloseTo(start.x, 10);
        expect(point.y).toBeCloseTo(start.y, 10);
      }
    });
  });
});
