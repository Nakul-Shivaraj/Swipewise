import { describe, it, expect } from "vitest";
import { resolveLocalCalendarDate } from "./user-date.js";

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
