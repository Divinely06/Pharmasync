import { describe, expect, it } from "vitest";
import { allocateFefo } from "./inventory";

describe("FEFO stock allocation", () => {
  it("consumes the earliest-expiry batch before later batches", () => {
    expect(allocateFefo([{ id: "soon", quantity: 2 }, { id: "later", quantity: 8 }], 5)).toEqual([
      { batchId: "soon", quantity: 2 },
      { batchId: "later", quantity: 3 },
    ]);
  });

  it("refuses requests above eligible batch stock", () => {
    expect(allocateFefo([{ id: "only", quantity: 2 }], 3)).toBeNull();
    expect(allocateFefo([{ id: "only", quantity: 2 }], 0)).toBeNull();
  });
});