import { describe, it, expect } from "vitest";
import { parseDayOfWeek, todayISO, addDays, datesRange } from "../../src/utils/util.js";

describe("parseDayOfWeek", () => {
    it.each([
        ["SUN", 0],
        ["MON", 1],
        ["TUE", 2],
        ["WED", 3],
        ["THU", 4],
        ["FRI", 5],
        ["SAT", 6],
    ])("parses '%s' as %i", (input, expected) => {
        expect(parseDayOfWeek(input)).toBe(expected);
    });

    it("is case-insensitive", () => {
        expect(parseDayOfWeek("mon")).toBe(1);
        expect(parseDayOfWeek("fri")).toBe(5);
    });

    it("trims whitespace", () => {
        expect(parseDayOfWeek(" MON ")).toBe(1);
    });

    it("returns null for unknown day abbreviation", () => {
        expect(parseDayOfWeek("XYZ")).toBeNull();
        expect(parseDayOfWeek("MONDAY")).toBeNull();
        expect(parseDayOfWeek("")).toBeNull();
    });
});

describe("addDays", () => {
    it("adds positive days", () => {
        expect(addDays("2024-01-01", 1)).toBe("2024-01-02");
        expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
        expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
    });

    it("adds zero days returns same date", () => {
        expect(addDays("2024-06-15", 0)).toBe("2024-06-15");
    });

    it("subtracts days with negative delta", () => {
        expect(addDays("2024-01-05", -2)).toBe("2024-01-03");
        expect(addDays("2024-03-01", -1)).toBe("2024-02-29"); // 2024 is leap year
    });

    it("handles month boundaries correctly", () => {
        expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
        expect(addDays("2024-04-30", 1)).toBe("2024-05-01");
    });

    it("adds multiple days", () => {
        expect(addDays("2024-01-01", 30)).toBe("2024-01-31");
        expect(addDays("2024-01-01", 365)).toBe("2024-12-31");
    });
});

describe("datesRange", () => {
    it("returns range of dates inclusive", () => {
        const result = datesRange("2024-01-01", "2024-01-03");
        expect(result).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"]);
    });

    it("returns single date when start equals end", () => {
        expect(datesRange("2024-06-15", "2024-06-15")).toEqual(["2024-06-15"]);
    });

    it("returns empty array when start is after end", () => {
        expect(datesRange("2024-01-05", "2024-01-01")).toEqual([]);
    });

    it("handles month boundary", () => {
        const result = datesRange("2024-01-30", "2024-02-01");
        expect(result).toEqual(["2024-01-30", "2024-01-31", "2024-02-01"]);
    });
});

describe("todayISO", () => {
    it("returns a string in YYYY-MM-DD format", () => {
        const result = todayISO();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a valid date", () => {
        const result = todayISO();
        const parsed = new Date(result);
        expect(isNaN(parsed.getTime())).toBe(false);
    });
});
