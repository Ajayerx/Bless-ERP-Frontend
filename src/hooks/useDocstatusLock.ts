import { useMemo } from "react"
import {
  resolveDocstatusAware,
  DEFAULT_FIELD_STATE,
  type ResolvedFieldState,
} from "@/modules/quotations/hooks/useVisibilityRules"

/**
 * Buying-form docstatus parity (Bills / Purchase Orders).
 *
 * Reuses the gold-standard engine from the Quotation form so Buying docs
 * behave identically across `docstatus`:
 * - Draft (0): fields editable; empty read-only fields are hidden.
 * - Submitted (1): read-only (allow_on_submit honoured); empty read-only
 *   fields are hidden.
 * - Cancelled (2): everything read-only; empty read-only fields hidden.
 *
 * `locked` is the coarse header/grid guard used across the Buying forms;
 * `field(name, value)` resolves per-field state tailored for hide-when-empty.
 */
export interface DocstatusLock {
  locked: boolean
  submitted: boolean
  isLocal: boolean
  field: (fieldname: string, value: unknown, exemptEmptyHide?: boolean) => ResolvedFieldState
  fieldEditable: (fieldname: string, value: unknown, exemptEmptyHide?: boolean) => boolean
  fieldVisible: (fieldname: string, value: unknown, exemptEmptyHide?: boolean) => boolean
}

export function useDocstatusLock(opts: {
  docstatus?: number
  mode: "create" | "edit"
}): DocstatusLock {
  return useMemo(() => {
    const docstatus = opts.mode === "edit" ? Number(opts.docstatus ?? 0) : 0
    const locked = opts.mode === "edit" && docstatus !== 0
    const resolve = (_fieldname: string, value: unknown, exemptEmptyHide = false): ResolvedFieldState =>
      resolveDocstatusAware(DEFAULT_FIELD_STATE, value, docstatus, exemptEmptyHide)
    return {
      locked,
      submitted: locked,
      isLocal: docstatus === 0,
      field: resolve,
      fieldEditable: (fieldname, value, exemptEmptyHide = false) =>
        !resolve(fieldname, value, exemptEmptyHide).readOnly,
      fieldVisible: (fieldname, value, exemptEmptyHide = false) =>
        resolve(fieldname, value, exemptEmptyHide).visible,
    }
  }, [opts.docstatus, opts.mode])
}