import { describe, it, expect } from "vitest";
import { formatCents, parseDollarsToCents } from "./money.js";

describe("money utilities (AGENTS.md §6)", () => {
  it("formats integer cents into $0.00 display strings", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(400)).toBe("$4.00");
    expect(formatCents(150)).toBe("$1.50");
    expect(formatCents(125)).toBe("$1.25");
    expect(formatCents(10000)).toBe("$100.00");
  });

  it("parses typed dollar strings into whole integer cents without floats", () => {
    expect(parseDollarsToCents("100")).toBe(10000);
    expect(parseDollarsToCents("$100.00")).toBe(10000);
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("1,500.5")).toBe(150050);
    expect(parseDollarsToCents("0.01")).toBe(1);
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("10.999")).toBeNull();
    expect(parseDollarsToCents("-50")).toBeNull();
    expect(parseDollarsToCents("-50", { allowNegative: true })).toBe(-5000);
    expect(parseDollarsToCents("-$50.25", { allowNegative: true })).toBe(-5025);
  });
});
