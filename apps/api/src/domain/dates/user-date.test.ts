import { describe, it, expect } from "vitest";
import {
  resolveLocalCalendarDate,
  getQuarterForCalendarDate,
  getNextQuarter,
  getCurrentAndNextQuarters,
  getQuarterStartDate,
  resolveUserQuarter,
  resolveCurrentAndNextQuarters,
} from "./user-date.js";

describe("resolveLocalCalendarDate (Issue #19)", () => {
  it("converts a UTC instant to YYYY-MM-DD in the user's IANA time zone", () => {
    // 2026-11-10T03:30:00.000Z is still Nov 9 in America/Los_Angeles (UTC-8),
    // still Nov 9 in America/New_York (UTC-5), and Nov 10 in UTC / Asia/Tokyo.
    const now = new Date("2026-11-10T03:30:00.000Z");

    expect(
      resolveLocalCalendarDate({ now, timeZone: "America/Los_Angeles" }),
    ).toBe("2026-11-09");
    expect(
      resolveLocalCalendarDate({ now, timeZone: "America/New_York" }),
    ).toBe("2026-11-09");
    expect(resolveLocalCalendarDate({ now, timeZone: "UTC" })).toBe(
      "2026-11-10",
    );
    expect(resolveLocalCalendarDate({ now, timeZone: "Asia/Tokyo" })).toBe(
      "2026-11-10",
    );
  });

  it("falls back to America/Los_Angeles if an invalid timeZone string is provided", () => {
    const now = new Date("2026-11-10T03:30:00.000Z");
    expect(
      resolveLocalCalendarDate({ now, timeZone: "Invalid/TimeZone" }),
    ).toBe("2026-11-09");
  });
});

describe("Quarter boundaries in the user's time zone (US-05 / Issue #23)", () => {
  it("maps Mar 31 to Q1, Apr 1 to Q2, and Dec 31 -> Jan 1 to the next year's Q1 in the user's time zone", () => {
    // 2026-04-01T03:30:00.000Z is 2026-03-31 20:30 PDT in America/Los_Angeles (Q1),
    // and 2026-04-01 03:30 UTC in UTC (Q2)
    const mar31InLaApr1InUtc = new Date("2026-04-01T03:30:00.000Z");
    expect(
      resolveUserQuarter({
        now: mar31InLaApr1InUtc,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("2026-Q1");
    expect(
      resolveUserQuarter({
        now: mar31InLaApr1InUtc,
        timeZone: "UTC",
      }),
    ).toBe("2026-Q2");

    // 2026-04-01 in America/Los_Angeles -> 2026-Q2
    const apr1InLa = new Date("2026-04-01T15:00:00.000Z");
    expect(
      resolveUserQuarter({
        now: apr1InLa,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("2026-Q2");

    // 2027-01-01T04:30:00.000Z is 2026-12-31 20:30 PST in America/Los_Angeles (2026-Q4),
    // and 2027-01-01 in UTC (2027-Q1)
    const dec31InLaJan1InUtc = new Date("2027-01-01T04:30:00.000Z");
    expect(
      resolveUserQuarter({
        now: dec31InLaJan1InUtc,
        timeZone: "America/Los_Angeles",
      }),
    ).toBe("2026-Q4");
    expect(
      resolveUserQuarter({
        now: dec31InLaJan1InUtc,
        timeZone: "UTC",
      }),
    ).toBe("2027-Q1");

    expect(
      resolveCurrentAndNextQuarters({
        now: dec31InLaJan1InUtc,
        timeZone: "America/Los_Angeles",
      }),
    ).toEqual(["2026-Q4", "2027-Q1"]);

    expect(
      resolveCurrentAndNextQuarters({
        now: dec31InLaJan1InUtc,
        timeZone: "UTC",
      }),
    ).toEqual(["2027-Q1", "2027-Q2"]);
  });

  it("computes quarter strings, next quarters, and quarter start dates across all 4 quarters", () => {
    expect(getQuarterForCalendarDate("2026-03-31")).toBe("2026-Q1");
    expect(getQuarterForCalendarDate("2026-04-01")).toBe("2026-Q2");
    expect(getQuarterForCalendarDate("2026-06-30")).toBe("2026-Q2");
    expect(getQuarterForCalendarDate("2026-07-01")).toBe("2026-Q3");
    expect(getQuarterForCalendarDate("2026-09-30")).toBe("2026-Q3");
    expect(getQuarterForCalendarDate("2026-10-01")).toBe("2026-Q4");
    expect(getQuarterForCalendarDate("2026-12-31")).toBe("2026-Q4");
    expect(getQuarterForCalendarDate("2027-01-01")).toBe("2027-Q1");

    expect(getNextQuarter("2026-Q1")).toBe("2026-Q2");
    expect(getNextQuarter("2026-Q2")).toBe("2026-Q3");
    expect(getNextQuarter("2026-Q3")).toBe("2026-Q4");
    expect(getNextQuarter("2026-Q4")).toBe("2027-Q1");

    expect(getCurrentAndNextQuarters("2026-03-31")).toEqual([
      "2026-Q1",
      "2026-Q2",
    ]);
    expect(getCurrentAndNextQuarters("2026-12-31")).toEqual([
      "2026-Q4",
      "2027-Q1",
    ]);

    expect(getQuarterStartDate("2026-Q1")).toBe("2026-01-01");
    expect(getQuarterStartDate("2026-Q2")).toBe("2026-04-01");
    expect(getQuarterStartDate("2026-Q3")).toBe("2026-07-01");
    expect(getQuarterStartDate("2026-Q4")).toBe("2026-10-01");
    expect(getQuarterStartDate("2027-Q1")).toBe("2027-01-01");
  });
});
