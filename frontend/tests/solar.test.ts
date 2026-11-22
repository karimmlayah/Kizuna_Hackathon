import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeSolar, finance } from "../utils/solar.ts";
test("sizing respects available area and produces no panels at zero area", () => {
  assert.equal(sizeSolar(7200, 0, 450).panels, 0);
  assert.equal(sizeSolar(7200, 4.4, 450).panels, 2);
  assert.equal(sizeSolar(7200, 45, 450).panels, 10);
  assert.equal(sizeSolar(7200, 4.4, 450).limited, true);
});
test("financial savings cannot exceed the annual bill", () => {
  const f = finance(100, 1000, 0.3, 2800, 0.8);
  assert.equal(f.annual, 300);
  assert.equal(f.points[0]?.value, -280000);
  assert.equal(f.points.length, 26);
  assert.equal(f.payback, null);
});
test("zero installation has no invented payback or carbon benefit", () => {
  const f = finance(0, 7200, 0.3, 2800, 0.8);
  assert.equal(f.payback, null);
  assert.equal(f.annual, 0);
  assert.equal(f.carbon, 0);
  assert.equal(f.points[25]?.value, 0);
});
test("projection includes annual degradation and maintenance", () => {
  const f = finance(4.5, 7200, 0.3, 2800, 0.8);
  assert.equal(f.cost, 12600);
  assert.equal(f.maintenance, 126);
  assert.ok(
    Math.abs(
      f.points[2]!.value - (-12600 + f.annual + f.annual * 0.995 - 252),
    ) < 0.001,
  );
});
