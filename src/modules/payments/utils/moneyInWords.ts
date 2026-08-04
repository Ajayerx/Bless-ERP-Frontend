const ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
]

const TENS = [
  "",
  "ten",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
]

const SCALE_WESTERN = [
  "",
  "thousand",
  "million",
  "billion",
  "trillion",
]

const SCALE_INDIAN = ["", "thousand", "lakh", "crore"]

function convertHundreds(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const remainder = n % 100

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} hundred`)
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder])
    } else {
      const tens = TENS[Math.floor(remainder / 10)]
      const ones = ONES[remainder % 10]
      parts.push(ones ? `${tens} ${ones}` : tens)
    }
  }

  return parts.join(" and ")
}

function inWordsWestern(n: number): string {
  if (n === 0) return "zero"

  const groups: number[] = []
  while (n > 0) {
    groups.push(n % 1000)
    n = Math.floor(n / 1000)
  }

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (group === 0) continue
    const words = convertHundreds(group)
    const scale = SCALE_WESTERN[i]
    parts.push(scale ? `${words} ${scale}` : words)
  }

  return parts.join(", ")
}

function inWordsIndian(n: number): string {
  if (n === 0) return "zero"

  const parts: string[] = []
  const lastThree = n % 1000
  n = Math.floor(n / 1000)

  let i = 0
  while (n > 0) {
    const group = n % 100
    if (group > 0) {
      const words = convertHundreds(group)
      parts.unshift(`${words} ${SCALE_INDIAN[i + 1]}`)
    }
    n = Math.floor(n / 100)
    i++
  }

  if (lastThree > 0) {
    parts.push(convertHundreds(lastThree))
  }

  return parts.join(", ")
}

function inWords(n: number, inMillion: boolean): string {
  return inMillion ? inWordsWestern(n) : inWordsIndian(n)
}

const NUMBER_FORMAT_INFO: Record<string, number> = {
  "#,###.##": 2,
  "#.###,##": 2,
  "# ###.##": 2,
  "# ###,##": 2,
  "#'###.##": 2,
  "#, ###.##": 2,
  "#,##,###.##": 2,
  "#,###.###": 3,
  "#.###": 0,
  "#,###": 0,
  "#.########": 8,
}

function getFractionLength(numberFormat: string): number {
  return NUMBER_FORMAT_INFO[numberFormat] ?? 2
}

export function moneyInWords(
  number: number | string | null | undefined,
  mainCurrency?: string,
  opts?: { fractionCurrency?: string; numberFormat?: string }
): string {
  const value = typeof number === "string" ? parseFloat(number) : number

  if (value === null || value === undefined || Number.isNaN(value)) return ""

  const amount = Number(value)
  if (amount < 0) return ""

  const currency = mainCurrency || "CAD"
  const fractionCurrency = opts?.fractionCurrency || "Cent"
  const numberFormat = opts?.numberFormat || "#,###.##"

  const fractionLength = getFractionLength(numberFormat)
  const inMillion = numberFormat !== "#,##,###.##"

  const formatted = amount.toFixed(fractionLength)
  const [mainPart, fractionPart] = formatted.split(".")
  const fraction = (fractionPart || "").padEnd(fractionLength, "0")

  const isZero = parseInt(mainPart, 10) === 0 && parseInt(fraction, 10) === 0

  if (isZero) {
    return `${currency} Zero only.`
  }

  if (parseInt(mainPart, 10) === 0) {
    return `${inWords(parseInt(fraction, 10), inMillion).replace(/\b\w/g, (c) => c.toUpperCase())} ${fractionCurrency} only.`
  }

  const mainWords = inWords(parseInt(mainPart, 10), inMillion).replace(/\b\w/g, (c) => c.toUpperCase())
  const fractionWords =
    parseInt(fraction, 10) > 0
      ? ` and ${inWords(parseInt(fraction, 10), inMillion).replace(/\b\w/g, (c) => c.toUpperCase())} ${fractionCurrency}`
      : ""

  return `${currency} ${mainWords}${fractionWords} only.`
}
