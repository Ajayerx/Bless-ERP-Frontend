/**
 * Safe evaluator for the Frappe `depends_on` expression subset we need.
 *
 * Supports field references (optionally `doc.`-prefixed), string/number
 * literals, comparison operators (`==`, `!=`, `>`, `<`, `>=`, `<=`), the
 * `in` operator, and the logical `and` / `or` / `not` (plus `!` alias).
 * Runs as a hand-written recursive-descent parser — never `eval`.
 */

type Value = string | number | boolean | Array<string | number> | null | undefined

export interface DependsOnContext {
  /** Resolve a field value by its fieldname. */
  getField: (fieldname: string) => Value
}

type Token =
  | { kind: "ident"; value: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "op"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "eof" }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++
      continue
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" })
      i++
      continue
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" })
      i++
      continue
    }
    if (ch === "'" || ch === '"') {
      const quote = ch
      let j = i + 1
      let out = ""
      while (j < src.length && src[j] !== quote) {
        out += src[j]
        j++
      }
      tokens.push({ kind: "string", value: out })
      i = j + 1
      continue
    }
    if (/[0-9]/.test(ch)) {
      let j = i
      let out = ""
      while (j < src.length && /[0-9.]/.test(src[j])) {
        out += src[j]
        j++
      }
      tokens.push({ kind: "number", value: parseFloat(out) })
      i = j
      continue
    }
    // operators: == != >= <= > < and or not in
    const two = src.slice(i, i + 2)
    if (two === "==" || two === "!=" || two === ">=" || two === "<=") {
      tokens.push({ kind: "op", value: two })
      i += 2
      continue
    }
    if (ch === ">" || ch === "<") {
      tokens.push({ kind: "op", value: ch })
      i++
      continue
    }
    // negation prefix — `!=` was consumed above, so a lone `!` is unary not.
    if (ch === "!") {
      tokens.push({ kind: "op", value: "!" })
      i++
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      let out = ""
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) {
        out += src[j]
        j++
      }
      tokens.push({ kind: "ident", value: out })
      i = j > i ? j : i + 1
      continue
    }
    i++
  }
  tokens.push({ kind: "eof" })
  return tokens
}

function isTruthy(v: Value): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") return v.trim() !== "" && v.trim().toLowerCase() !== "false" && v !== "0"
  if (typeof v === "number") return v !== 0
  if (Array.isArray(v)) return v.length > 0
  return !!v
}

function looseEq(a: Value, b: Value): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b
  return String(a ?? "") === String(b ?? "")
}

function valueOf(token: Token, ctx: DependsOnContext): Value {
  switch (token.kind) {
    case "string":
      return token.value
    case "number":
      return token.value
    case "ident": {
      const name = token.value.replace(/^!?doc\./, "").replace(/^!/, "")
      if (name === "true") return true
      if (name === "false") return false
      return ctx.getField(name)
    }
    default:
      return undefined
  }
}

class Parser {
  private tokens: Token[]
  private ctx: DependsOnContext
  private pos = 0

  constructor(tokens: Token[], ctx: DependsOnContext) {
    this.tokens = tokens
    this.ctx = ctx
  }

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private next(): Token {
    const tok = this.tokens[this.pos]
    if (tok.kind !== "eof") this.pos++
    return tok
  }

  parseExpression(): boolean {
    const value = this.parseOr()
    return isTruthy(value)
  }

  private parseOr(): boolean {
    let left = this.parseAnd()
    let tok = this.peek()
    while (tok.kind === "ident" && tok.value === "or") {
      this.next()
      const right = this.parseAnd()
      left = left || right
      tok = this.peek()
    }
    return left
  }

  private parseAnd(): boolean {
    let left = this.parseNot()
    let tok = this.peek()
    while (tok.kind === "ident" && tok.value === "and") {
      this.next()
      const right = this.parseNot()
      left = left && right
      tok = this.peek()
    }
    return left
  }

  private parseNot(): boolean {
    const tok = this.peek()
    if (tok.kind === "op" && tok.value === "!") {
      this.next()
      return !this.parseNot()
    }
    if (tok.kind === "ident") {
      if (tok.value.startsWith("!")) {
        this.next()
        return !isTruthy(valueOf(tok, this.ctx))
      }
      if (tok.value === "not") {
        this.next()
        return !this.parseNot()
      }
    }
    return this.parseComparison()
  }

  private parseComparison(): boolean {
    const leftTok = this.peek()
    let left: Value
    if (leftTok.kind === "lparen") {
      this.next()
      const inner = this.parseOr()
      if (this.peek().kind === "rparen") this.next()
      left = inner
    } else {
      left = valueOf(this.next(), this.ctx)
      const op = this.peek()
      // infix `in` / `not in`
      if (op.kind === "ident" && (op.value === "in" || op.value === "not in")) {
        this.next()
        const right = valueOf(this.next(), this.ctx)
        const members = typeof right === "string" ? right.split(",") : Array.isArray(right) ? right : [String(right ?? "")]
        const matched = members.some((m) => String(m) === String(left ?? ""))
        return op.value === "in" ? matched : !matched
      }
      if (op.kind === "op") {
        this.next()
        const right = valueOf(this.next(), this.ctx)
        const l = left
        const r = right
        switch (op.value) {
          case "==":
            return looseEq(l, r)
          case "!=":
            return !looseEq(l, r)
          case ">":
            return Number(l ?? 0) > Number(r ?? 0)
          case "<":
            return Number(l ?? 0) < Number(r ?? 0)
          case ">=":
            return Number(l ?? 0) >= Number(r ?? 0)
          case "<=":
            return Number(l ?? 0) <= Number(r ?? 0)
        }
      }
    }
    return isTruthy(left)
  }
}

/**
 * Evaluate a `depends_on` expression string against a field-resolver.
 * Empty/undefined expressions evaluate to `true` (field always visible).
 */
export function evalDependsOn(expr: string | undefined, ctx: DependsOnContext): boolean {
  if (!expr || !expr.trim()) return true
  // `route_options:` and bare `eval:` prefixes — route option refs resolve to
  // nothing in a form context (treated as "not set"); eval bodies fall through.
  if (/^route_options:/.test(expr.trim())) return false
  const src = expr.trim().replace(/^eval:/, "")
  try {
    const parser = new Parser(tokenize(src), ctx)
    return parser.parseExpression()
  } catch {
    // Never throw on an unparseable rule — default to visible.
    return true
  }
}