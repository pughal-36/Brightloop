import { describe, it, expect } from "vitest";
import {
  add,
  sub,
  parseRupeesToPaise,
  formatINR,
  percentOf,
} from "./money";

describe("money.ts - BrightLoop integer paise helpers", () => {
  describe("parseRupeesToPaise", () => {
    it("parses integer rupees correctly", () => {
      expect(parseRupeesToPaise("100")).toBe(10000);
      expect(parseRupeesToPaise(100)).toBe(10000);
      expect(parseRupeesToPaise("0")).toBe(0);
      expect(parseRupeesToPaise(0)).toBe(0);
      expect(parseRupeesToPaise("1")).toBe(100);
    });

    it("parses rupees with 1 and 2 decimal places", () => {
      expect(parseRupeesToPaise("100.5")).toBe(10050);
      expect(parseRupeesToPaise("100.50")).toBe(10050);
      expect(parseRupeesToPaise(100.5)).toBe(10050);
      expect(parseRupeesToPaise("0.05")).toBe(5);
      expect(parseRupeesToPaise("0.99")).toBe(99);
      expect(parseRupeesToPaise("0.01")).toBe(1);
    });

    it("rounds sub-paise amounts half-up", () => {
      // Exactly half paise (0.005 rupees = 0.5 paise) -> rounds to 1 paise
      expect(parseRupeesToPaise("10.005")).toBe(1001);
      expect(parseRupeesToPaise("10.0050")).toBe(1001);
      // Below half paise -> rounds down
      expect(parseRupeesToPaise("10.0049")).toBe(1000);
      expect(parseRupeesToPaise("10.004")).toBe(1000);
      // Above half paise -> rounds up
      expect(parseRupeesToPaise("10.0051")).toBe(1001);
      expect(parseRupeesToPaise("10.006")).toBe(1001);
    });

    it("handles currency symbols, spaces, and commas", () => {
      expect(parseRupeesToPaise("₹1,23,456.78")).toBe(12345678);
      expect(parseRupeesToPaise("₹ 500")).toBe(50000);
      expect(parseRupeesToPaise("Rs. 250.50")).toBe(25050);
      expect(parseRupeesToPaise("RS. 1,000")).toBe(100000);
      expect(parseRupeesToPaise("  ₹  99.99  ")).toBe(9999);
    });

    it("handles negative amounts", () => {
      expect(parseRupeesToPaise("-100.50")).toBe(-10050);
      expect(parseRupeesToPaise(-50.25)).toBe(-5025);
      expect(parseRupeesToPaise("-₹1,000.50")).toBe(-100050);
      expect(parseRupeesToPaise("-10.005")).toBe(-1001);
      expect(parseRupeesToPaise("-10.004")).toBe(-1000);
      expect(parseRupeesToPaise("-0")).toBe(0);
    });

    it("throws on invalid input formats", () => {
      expect(() => parseRupeesToPaise("")).toThrow(TypeError);
      expect(() => parseRupeesToPaise("   ")).toThrow(TypeError);
      expect(() => parseRupeesToPaise("abc")).toThrow(TypeError);
      expect(() => parseRupeesToPaise("12.34.56")).toThrow(TypeError);
      expect(() => parseRupeesToPaise(Number.NaN)).toThrow(TypeError);
      expect(() => parseRupeesToPaise(Number.POSITIVE_INFINITY)).toThrow(TypeError);
      expect(() => parseRupeesToPaise(null as unknown as string)).toThrow(TypeError);
      expect(() => parseRupeesToPaise(undefined as unknown as string)).toThrow(TypeError);
    });
  });

  describe("formatINR", () => {
    it("formats zero and small amounts correctly", () => {
      expect(formatINR(0)).toBe("₹0.00");
      expect(formatINR(5)).toBe("₹0.05");
      expect(formatINR(50)).toBe("₹0.50");
      expect(formatINR(99)).toBe("₹0.99");
      expect(formatINR(100)).toBe("₹1.00");
    });

    it("formats Indian grouping system correctly (lakhs and crores)", () => {
      expect(formatINR(100000)).toBe("₹1,000.00");
      expect(formatINR(1000000)).toBe("₹10,000.00");
      expect(formatINR(10000000)).toBe("₹1,00,000.00");
      expect(formatINR(100000000)).toBe("₹10,00,000.00");
      expect(formatINR(1000000000)).toBe("₹1,00,00,000.00");
      expect(formatINR(12345678)).toBe("₹1,23,456.78");
    });

    it("formats negative amounts", () => {
      expect(formatINR(-5)).toBe("-₹0.05");
      expect(formatINR(-100)).toBe("-₹1.00");
      expect(formatINR(-10050)).toBe("-₹100.50");
      expect(formatINR(-12345678)).toBe("-₹1,23,456.78");
    });

    it("respects showSymbol option", () => {
      expect(formatINR(12345678, { showSymbol: false })).toBe("1,23,456.78");
      expect(formatINR(-12345678, { showSymbol: false })).toBe("-1,23,456.78");
      expect(formatINR(0, { showSymbol: false })).toBe("0.00");
    });

    it("rejects non-integer paise inputs", () => {
      expect(() => formatINR(100.5)).toThrow(TypeError);
      expect(() => formatINR(Number.NaN)).toThrow(TypeError);
      expect(() => formatINR(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    });
  });

  describe("add and sub", () => {
    it("adds paise amounts correctly", () => {
      expect(add(100, 200)).toBe(300);
      expect(add(100, 200, 300, 400)).toBe(1000);
      expect(add(0, 0)).toBe(0);
      expect(add(500, -200)).toBe(300);
      expect(add(-500, -200)).toBe(-700);
    });

    it("subtracts paise amounts correctly", () => {
      expect(sub(500, 200)).toBe(300);
      expect(sub(200, 500)).toBe(-300);
      expect(sub(200, -300)).toBe(500);
      expect(sub(0, 0)).toBe(0);
      expect(sub(100, 100)).toBe(0);
    });

    it("enforces safe integer paise inputs", () => {
      expect(() => add(100.5, 200)).toThrow(TypeError);
      expect(() => add(100, 200.5)).toThrow(TypeError);
      expect(() => sub(500.5, 200)).toThrow(TypeError);
      expect(() => sub(500, 200.5)).toThrow(TypeError);
    });
  });

  describe("percentOf", () => {
    it("calculates exact percentage for integer results", () => {
      expect(percentOf(10000, 18)).toBe(1800);
      expect(percentOf(10000, 5)).toBe(500);
      expect(percentOf(10000, 100)).toBe(10000);
      expect(percentOf(50000, 10)).toBe(5000);
    });

    it("returns zero when amount or rate is zero", () => {
      expect(percentOf(0, 18)).toBe(0);
      expect(percentOf(10000, 0)).toBe(0);
      expect(percentOf(0, 0)).toBe(0);
    });

    it("rounds half-up on exact ties (0.5 paise)", () => {
      // 100 paise @ 18.5% = 18.5 paise -> rounds to 19
      expect(percentOf(100, 18.5)).toBe(19);

      // 10 paise @ 5% = 0.5 paise -> rounds to 1
      expect(percentOf(10, 5)).toBe(1);

      // 30 paise @ 5% = 1.5 paise -> rounds to 2
      expect(percentOf(30, 5)).toBe(2);

      // 50 paise @ 5% = 2.5 paise -> rounds to 3
      expect(percentOf(50, 5)).toBe(3);

      // 70 paise @ 5% = 3.5 paise -> rounds to 4
      expect(percentOf(70, 5)).toBe(4);
    });

    it("rounds down when strictly below 0.5 paise", () => {
      // 100 paise @ 18.49% = 18.49 paise -> rounds to 18
      expect(percentOf(100, 18.49)).toBe(18);

      // 10 paise @ 4.9% = 0.49 paise -> rounds to 0
      expect(percentOf(10, 4.9)).toBe(0);

      // 30 paise @ 4.9% = 1.47 paise -> rounds to 1
      expect(percentOf(30, 4.9)).toBe(1);
    });

    it("rounds up when strictly above 0.5 paise", () => {
      // 100 paise @ 18.51% = 18.51 paise -> rounds to 19
      expect(percentOf(100, 18.51)).toBe(19);

      // 10 paise @ 5.1% = 0.51 paise -> rounds to 1
      expect(percentOf(10, 5.1)).toBe(1);

      // 1005 paise @ 18% = 180.9 paise -> rounds to 181
      expect(percentOf(1005, 18)).toBe(181);
    });

    it("handles realistic GST and discount calculations", () => {
      // ₹1,499 with 18% GST = 149900 * 0.18 = 26982 paise
      expect(percentOf(149900, 18)).toBe(26982);

      // ₹999 with 18% GST = 99900 * 0.18 = 17982 paise
      expect(percentOf(99900, 18)).toBe(17982);

      // 2.5% discount on ₹2,500 = 250000 * 0.025 = 6250 paise
      expect(percentOf(250000, 2.5)).toBe(6250);

      // Small fractional tax rate: 0.25% on ₹1,000 = 100000 * 0.0025 = 250 paise
      expect(percentOf(100000, 0.25)).toBe(250);

      // 0.125% rate on ₹800 = 80000 * 0.00125 = 100 paise
      expect(percentOf(80000, 0.125)).toBe(100);
    });

    it("handles negative amounts consistently", () => {
      expect(percentOf(-100, 18.5)).toBe(-19);
      expect(percentOf(-100, 18.49)).toBe(-18);
      expect(percentOf(-100, 18.51)).toBe(-19);
      expect(percentOf(-1005, 18)).toBe(-181);
    });

    it("rejects non-integer paise base amount", () => {
      expect(() => percentOf(100.5, 18)).toThrow(TypeError);
      expect(() => percentOf(Number.NaN, 18)).toThrow(TypeError);
    });
  });
});

