import { describe, expect, it } from "vitest";
import { isOrgScopedPath } from "./storage-paths.ts";

// A real org id, so the tests exercise the same shape the app actually produces
// (src/lib/upload/uploadDocument.ts builds `${orgId}/${uploadId}/...`).
const ORG = "8f2b1c4e-9a3d-4f21-b0c7-5e6d7a8b9c01";
const OTHER_ORG = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

describe("isOrgScopedPath", () => {
  it("accepts a path whose first segment is the caller's org id", () => {
    expect(isOrgScopedPath(`${ORG}/original.pdf`, ORG)).toBe(true);
  });

  it("accepts a nested path under the org folder", () => {
    expect(isOrgScopedPath(`${ORG}/d3f8/part-1`, ORG)).toBe(true);
  });

  it("rejects a path belonging to another org", () => {
    expect(isOrgScopedPath(`${OTHER_ORG}/d3f8/original.pdf`, ORG)).toBe(false);
  });

  it("rejects traversal that escapes the org folder", () => {
    expect(isOrgScopedPath(`${ORG}/../${OTHER_ORG}/original.pdf`, ORG)).toBe(false);
  });

  it("rejects a bare '..' anywhere in the path", () => {
    expect(isOrgScopedPath(`${ORG}/d3f8/../../${OTHER_ORG}/x`, ORG)).toBe(false);
  });

  it("rejects the org folder itself with no object key", () => {
    expect(isOrgScopedPath(ORG, ORG)).toBe(false);
    expect(isOrgScopedPath(`${ORG}/`, ORG)).toBe(false);
  });

  it("rejects a leading slash, which shifts the first path segment", () => {
    expect(isOrgScopedPath(`/${ORG}/original.pdf`, ORG)).toBe(false);
  });

  it("rejects an org id that merely prefixes the first segment", () => {
    expect(isOrgScopedPath(`${ORG}-evil/original.pdf`, ORG)).toBe(false);
  });

  it("rejects backslashes, which Postgres storage.foldername does not treat as separators", () => {
    expect(isOrgScopedPath(`${ORG}\\..\\${OTHER_ORG}\\x`, ORG)).toBe(false);
  });

  it("rejects empty path segments", () => {
    expect(isOrgScopedPath(`${ORG}//original.pdf`, ORG)).toBe(false);
  });

  it("rejects a '.' segment", () => {
    expect(isOrgScopedPath(`${ORG}/./original.pdf`, ORG)).toBe(false);
  });

  it("rejects an empty path", () => {
    expect(isOrgScopedPath("", ORG)).toBe(false);
  });

  // The bucket policy compares `(storage.foldername(name))[1]::uuid` — a CAST, so it is
  // case-insensitive. A strict string compare here would 403 an object the policy had
  // already accepted into the caller's own folder.
  it("accepts an org folder that differs from the org id only in case", () => {
    expect(isOrgScopedPath(`${ORG.toUpperCase()}/original.pdf`, ORG)).toBe(true);
  });

  it("still rejects another org's folder regardless of case", () => {
    expect(isOrgScopedPath(`${OTHER_ORG.toUpperCase()}/original.pdf`, ORG)).toBe(false);
  });

  // A security guard must reject input it doesn't recognise, not throw on it and not skip it.
  it.each([
    ["a number", 123],
    ["an array", ["x/y"]],
    ["an object", { toString: "x/y" }],
    ["null", null],
    ["undefined", undefined],
    ["a boolean", true],
  ])("rejects %s rather than throwing", (_label, value) => {
    expect(isOrgScopedPath(value, ORG)).toBe(false);
  });
});
