import { describe, expect, it } from "vitest";
import { hasPaymentProof } from "./payment-validation";

describe("hasPaymentProof", () => {
  it("requires an uploaded receipt before payment submission", () => {
    expect(hasPaymentProof(null)).toBe(false);
    expect(hasPaymentProof(new File(["proof"], "receipt.png", { type: "image/png" }))).toBe(true);
  });
});