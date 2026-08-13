import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildSimpleXlsx } from "./xlsx-writer.ts";

describe("buildSimpleXlsx", () => {
  it("produces a real, readable .xlsx — verified by reading it back with SheetJS", async () => {
    const bytes = await buildSimpleXlsx("Fields", [
      ["field_path", "value", "requires_review"],
      ["invoice_number", "INV-2026-0417", true],
      ["grand_total", 92, false],
    ]);

    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toEqual(["Fields"]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Fields"], { header: 1 });
    expect(rows[0]).toEqual(["field_path", "value", "requires_review"]);
    expect(rows[1]).toEqual(["invoice_number", "INV-2026-0417", true]);
    expect(rows[2]).toEqual(["grand_total", 92, false]);
  });

  it("handles an empty rows array without producing an invalid sheet", async () => {
    const bytes = await buildSimpleXlsx("Empty", []);
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toEqual(["Empty"]);
  });
});
