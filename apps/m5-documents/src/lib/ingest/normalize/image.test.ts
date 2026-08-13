import { describe, expect, it } from "vitest";
import { computeTargetSize, MAX_LONG_EDGE } from "./image.ts";

describe("computeTargetSize", () => {
  it("leaves an image already within the limit untouched", () => {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("downscales a landscape image so its long edge hits the cap exactly", () => {
    const result = computeTargetSize(5000, 2500);
    expect(result.width).toBe(MAX_LONG_EDGE);
    expect(result.height).toBe(1288); // 2500 * (2576/5000), rounded
  });

  it("downscales a portrait image by height instead of width", () => {
    const result = computeTargetSize(2000, 6000);
    expect(result.height).toBe(MAX_LONG_EDGE);
    expect(result.width).toBe(859); // 2000 * (2576/6000), rounded
  });

  it("treats exactly-at-the-limit as untouched (boundary)", () => {
    expect(computeTargetSize(MAX_LONG_EDGE, 1000)).toEqual({ width: MAX_LONG_EDGE, height: 1000 });
  });
});
