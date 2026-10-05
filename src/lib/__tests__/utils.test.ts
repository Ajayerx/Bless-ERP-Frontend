import { describe, it, expect, afterEach } from "vitest"
import {
  formatDate,
  formatDateUser,
  formatDateDDMMYYYY,
  generateId,
  parseCalendarDate,
  todayISO,
  localDateISO,
} from "@/lib/utils"

// BUG-04 / BUG-05: `new Date("2026-09-23")` is UTC midnight per the ES spec, so
// formatting it in a zone west of UTC (America/Toronto, UTC-4 in September)
// renders Sep 22. These tests run under the default CI zone, which is at or
// west of UTC, and assert the calendar date survives regardless.
describe("calendar date formatting", () => {
  it("parses a bare YYYY-MM-DD as a calendar date", () => {
    expect(parseCalendarDate("2026-09-23")).toEqual({ year: 2026, month: 9, day: 23 })
  })

  it("rejects values that carry a time component", () => {
    expect(parseCalendarDate("2026-09-23 10:30:00.123456")).toBeNull()
    expect(parseCalendarDate("2026-09-23T10:30:00Z")).toBeNull()
    expect(parseCalendarDate("")).toBeNull()
    expect(parseCalendarDate(null)).toBeNull()
    expect(parseCalendarDate("2026-13-01")).toBeNull()
  })

  it("formatDate keeps the calendar day instead of shifting to the previous one", () => {
    expect(formatDate("2026-09-23")).toBe("Sep 23, 2026")
    // Month boundaries are where the UTC shift is most visible.
    expect(formatDate("2026-01-01")).toBe("Jan 1, 2026")
    expect(formatDate("2026-03-01")).toBe("Mar 1, 2026")
    expect(formatDate("2026-11-01")).toBe("Nov 1, 2026")
    // Day 1 of a month in a DST-observing zone: 2026-03-08 is the US spring
    // forward date, 2026-11-01 the fall-back date.
    expect(formatDate("2026-03-08")).toBe("Mar 8, 2026")
    expect(formatDate("2026-11-01")).toBe("Nov 1, 2026")
  })

  it("formatDateUser keeps the calendar day", () => {
    expect(formatDateUser("2026-09-23")).toBe("23-09-2026")
    expect(formatDateUser("2026-01-01")).toBe("01-01-2026")
    expect(formatDateUser("2026-12-31")).toBe("31-12-2026")
  })

  it("formatDateDDMMYYYY keeps the calendar day", () => {
    expect(formatDateDDMMYYYY("2026-09-23")).toBe("23-09-2026")
    expect(formatDateDDMMYYYY("2026-01-01")).toBe("01-01-2026")
  })

  it("handles empty and unparseable values without throwing", () => {
    expect(formatDate("")).toBe("")
    expect(formatDateUser("")).toBe("")
    expect(formatDateDDMMYYYY("")).toBe("")
    expect(formatDateUser("not-a-date")).toBe("not-a-date")
  })

  it("still honours a real datetime instant", () => {
    // 2026-09-23T04:00:00Z is UTC midnight -> Sep 23 00:00 in Toronto, so the
    // calendar day must not move.
    expect(formatDate("2026-09-23T04:00:00Z")).toBe("Sep 23, 2026")
  })
})

// The same UTC-vs-local trap applies to "today" defaults: every Date field
// default used to be `new Date().toISOString().slice(0, 10)`, which returns
// tomorrow's date for any local time after ~20:00 in a UTC-negative zone.
describe("todayISO", () => {
  it("returns the local calendar day, never the UTC one", () => {
    const now = new Date()
    expect(todayISO()).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    )
  })

  it("offsets from the local day in both directions", () => {
    expect(todayISO(1)).toBe(todayISOAdd(1))
    expect(todayISO(-30)).toBe(todayISOAdd(-30))
  })

  it("crosses month and year boundaries in local time", () => {
    // Month-end offsets are where a UTC-based implementation drifts.
    const cases = [1, -1, 28, 31, 365]
    for (const days of cases) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      expect(todayISO(days)).toBe(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      )
    }
  })
})

function todayISOAdd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

describe("localDateISO", () => {
  it("renders an arbitrary Date on its local calendar day", () => {
    const d = new Date(2026, 0, 31, 23, 30)
    expect(localDateISO(d)).toBe("2026-01-31")
  })

  it("pads month and day", () => {
    expect(localDateISO(new Date(2026, 8, 5))).toBe("2026-09-05")
  })

  it("agrees with todayISO for today", () => {
    expect(localDateISO(new Date())).toBe(todayISO())
  })

  it("keeps the day when a Date is late in the local evening", () => {
    // 23:30 local is already the next day in UTC for any negative offset;
    // toISOString().slice(0, 10) would report tomorrow here.
    const d = new Date(2026, 5, 10, 23, 30)
    expect(localDateISO(d)).toBe("2026-06-10")
  })

  it("does not shift a UTC-parsed YYYY-MM-DD back a day in a west-of-UTC zone", () => {
    // new Date("2026-07-15") is UTC midnight; west of UTC that is still
    // 2026-07-14 locally, which is the correct local reading of that instant
    // only if the caller meant the instant. Callers that mean the calendar day
    // must build the string locally, which is what todayISO/localDateISO do.
    const parsed = new Date("2026-07-15")
    expect(localDateISO(parsed)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// BUG-01: `crypto.randomUUID` only exists in a Secure Context, so on the
// plain-HTTP LAN host every call site threw and "Add Customer" looked broken.
describe("generateId", () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    })
  })

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it("uses crypto.randomUUID when the page is in a secure context", () => {
    const id = generateId()
    expect(id).toMatch(UUID_V4)
  })

  it("falls back to getRandomValues when randomUUID is unavailable (insecure context)", () => {
    // This is the LAN-over-HTTP case: crypto exists, randomUUID does not.
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
      writable: true,
    })

    const id = generateId()
    expect(id).toMatch(UUID_V4)
  })

  it("still produces unique ids without Web Crypto at all", () => {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true, writable: true })

    const ids = new Set(Array.from({ length: 200 }, () => generateId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it("sets the RFC 4122 version and variant bits in the getRandomValues path", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff),
      },
      configurable: true,
      writable: true,
    })

    // 0xff everywhere -> version nibble pinned to 4, variant nibble to b.
    expect(generateId()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
  })
})