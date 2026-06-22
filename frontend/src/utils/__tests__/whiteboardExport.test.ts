/**
 * whiteboardExport tests
 *
 * Run with: `npx jest __tests__/whiteboardExport.test.ts`
 *
 * Validates SVG output geometry and the deterministic ordering of points.
 * PNG output is exercised via a stub that emulates the canvas API.
 */

import { exportOpsAsSvg, drawOps } from '../whiteboardExport';
import type { WhiteboardOp } from '../../types/whiteboardSession';

const baseOp = (overrides: Partial<WhiteboardOp> = {}): WhiteboardOp => ({
  tool: 'pen',
  userId: 'tester',
  ts: 1_700_000_000_000,
  color: '#000000',
  width: 2,
  points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  ...overrides,
});

describe('exportOpsAsSvg', () => {
  it('produces an SVG document with the requested dimensions', () => {
    const svg = exportOpsAsSvg([baseOp()], { width: 800, height: 600 });
    expect(svg).toMatch(/<svg[^>]*width="800"/);
    expect(svg).toMatch(/height="600"/);
    expect(svg).toMatch(/<polyline/);
  });

  it('skips ops with no points', () => {
    const svg = exportOpsAsSvg([baseOp({ points: [] })], { width: 100, height: 100 });
    expect(svg).not.toMatch(/<polyline/);
  });

  it('emits a line for the line tool', () => {
    const svg = exportOpsAsSvg(
      [baseOp({ tool: 'line', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })],
      { width: 100, height: 100 }
    );
    expect(svg).toMatch(/<line[^>]*x1="0.00"[^>]*x2="10.00"/);
  });

  it('emits a rect for the rectangle tool', () => {
    const svg = exportOpsAsSvg(
      [baseOp({ tool: 'rectangle', points: [{ x: 0, y: 0 }, { x: 10, y: 20 }] })],
      { width: 100, height: 100 }
    );
    expect(svg).toMatch(/<rect[^>]*width="10.00"[^>]*height="20.00"/);
  });

  it('emits a circle for the circle tool', () => {
    const svg = exportOpsAsSvg(
      [baseOp({ tool: 'circle', points: [{ x: 5, y: 5 }, { x: 15, y: 5 }] })],
      { width: 100, height: 100 }
    );
    expect(svg).toMatch(/<circle[^>]*r="10.00"/);
  });

  it('text ops render escaped content as text nodes', () => {
    const svg = exportOpsAsSvg(
      [
        baseOp({
          tool: 'text',
          points: [{ x: 5, y: 5 }],
          text: 'Hello <world> & others',
          color: '#222',
          width: 3,
        }),
      ],
      { width: 100, height: 100 }
    );
    expect(svg).toMatch(/Hello &lt;world&gt; &amp; others/);
  });

  it('escapes malicious color attribute values', () => {
    const svg = exportOpsAsSvg(
      [baseOp({ color: '#000" onclick="alert(1)"' })],
      { width: 100, height: 100 }
    );
    expect(svg).not.toMatch(/onclick="alert\(1\)"/);
  });
});

describe('drawOps', () => {
  it('invokes canvas primitives without throwing on a stubbed context', () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop === 'symbol') return undefined;
          calls.push(String(prop));
          // Return a no-op function for method-like props; otherwise a number.
          return (..._args: unknown[]) => undefined;
        },
        set() {
          return true;
        },
      }
    ) as unknown as CanvasRenderingContext2D;

    expect(() =>
      drawOps(ctx, [
        baseOp(),
        baseOp({ tool: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }),
        baseOp({ tool: 'rectangle', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }),
        baseOp({ tool: 'circle', points: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }),
      ])
    ).not.toThrow();
    expect(calls).toContain('beginPath');
    expect(calls).toContain('stroke');
  });
});
