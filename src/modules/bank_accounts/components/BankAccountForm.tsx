"use client"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { Input, Select, Switch } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { labelClass } from "@/components/ui/form-fields"
import { bankAccountService, type BankAccountFormData } from "@/services"

interface Props {
  initial?: Partial<BankAccountFormData>
  prefill?: { party_type?: string; party?: string }
  onSubmit: (data: BankAccountFormData) => Promise<void>
}

export interface BankAccountFormRef {
  submit: () => void
}

const EMPTY: BankAccountFormData = {
  account_name: "",
  bank: "",
  is_company_account: true,
  company: "",
  account: "",
  account_type: "",
  account_subtype: "",
  party_type: "",
  party: "",
  is_default: false,
  iban: "",
  bank_account_no: "",
  branch_code: "",
  disabled: false,
  last_integration_date: "",
}

export default forwardRef<BankAccountFormRef, Props>(function BankAccountForm({ initial, prefill, onSubmit }, ref) {
  const [form, setForm] = useState<BankAccountFormData>(() => ({
    ...EMPTY,
    ...initial,
    ...(prefill?.party_type ? { party_type: prefill.party_type, is_company_account: false } : {}),
    ...(prefill?.party ? { party: prefill.party } : {}),
  }))
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [partyTypes, setPartyTypes] = useState<string[]>(["Customer", "Supplier", "Employee"])

  useEffect(() => {
    let alive = true
    bankAccountService.partyTypes()
      .then((names) => {
        if (alive) setPartyTypes(names)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const set = (patch: Partial<BankAccountFormData>) => setForm((prev) => ({ ...prev, ...patch }))

  const validate = (): string => {
    if (!form.account_name.trim()) return "Account name is required."
    if (!form.bank.trim()) return "Bank is required."
    if (form.is_company_account) {
      if (!form.company.trim()) return "Company is required for company accounts."
      if (!form.account.trim()) return "Company Account is required for company accounts."
    }
    if (!form.is_company_account && form.party_type && !form.party.trim()) {
      return "Party is required for the selected party type."
    }
    return ""
  }

  useImperativeHandle(ref, () => ({
    submit: async () => {
      const msg = validate()
      if (msg) {
        setError(msg)
        return
      }
      setError("")
      setSubmitting(true)
      try {
        await onSubmit(form)
      } finally {
        setSubmitting(false)
      }
    },
  }))

  return (
    <form className="space-y-6">
      {error && (
        <div className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="account_name" className={labelClass}>Account Name *</label>
          <Input id="account_name"
            value={form.account_name}
            onChange={(e) => {
              set({ account_name: e.target.value })
              if (error) setError("")
            }}
            placeholder="Business Chequing"
          />
        </div>
        <div>
          <label htmlFor="bank" className={labelClass}>Bank *</label>
          <LinkSearchField
            id="bank"
            value={form.bank}
            onChange={(v) => {
              set({ bank: v ?? "" })
              if (error) setError("")
            }}
            searchFn={async (q) => {
              const items = await bankAccountService.searchLink("Bank", q)
              return { items }
            }}
            validate={async (v) => {
              await bankAccountService.validateLink("Bank", v)
            }}
            docType="Bank"
            placeholder="Select bank…"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-8 pt-2">
          <label className="block text-sm font-medium text-body">
            Company Bank Account
            <span className="block text-xs text-muted font-normal mt-0.5">Requires company and a Bank-type GL account.</span>
          </label>
          <Switch checked={form.is_company_account} onChange={(v) => set({ is_company_account: v })} />
        </div>
        <div className="flex items-center gap-8 pt-2">
          <label className="block text-sm font-medium text-body">
            Default Account
            <span className="block text-xs text-muted font-normal mt-0.5">Scoped to party + company.</span>
          </label>
          <Switch checked={form.is_default} onChange={(v) => set({ is_default: v })} />
        </div>
      </div>

      {form.is_company_account ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="company" className={labelClass}>Company *</label>
            <LinkSearchField
              id="company"
              value={form.company}
              onChange={(v) => {
                set({ company: v ?? "" })
                if (error) setError("")
              }}
              searchFn={async (q) => {
                const items = await bankAccountService.searchLink("Company", q)
                return { items }
              }}
              validate={async (v) => {
                await bankAccountService.validateLink("Company", v)
              }}
              docType="Company"
              placeholder="Select company…"
              suppressExternalLabelFetch
            />
          </div>
          <div>
            <label htmlFor="account" className={labelClass}>Company Account *</label>
            <LinkSearchField
              id="account"
              value={form.account}
              onChange={(v) => {
                set({ account: v ?? "" })
                if (error) setError("")
              }}
              searchFn={async (q) => {
                const items = await bankAccountService.searchLink("Account", q, undefined, [
                  ["account_type", "=", "Bank"],
                  ["is_group", "=", 0],
                  ...(form.company ? [["company", "=", form.company]] : []),
                ])
                return { items }
              }}
              validate={async (v) => {
                await bankAccountService.validateLink("Account", v)
              }}
              docType="Account"
              placeholder="Select Bank-type account…"
              suppressExternalLabelFetch
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="party_type" className={labelClass}>Party Type</label>
            <Select
              id="party_type"
              value={form.party_type}
              onChange={(e) => {
                set({ party_type: e.target.value, party: "" })
                if (error) setError("")
              }}
            >
              <option value="">— Select —</option>
              {partyTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="party" className={labelClass}>Party {form.party_type ? "*" : ""}</label>
            <LinkSearchField
              id="party"
              value={form.party}
              onChange={(v) => {
                set({ party: v ?? "" })
                if (error) setError("")
              }}
              searchFn={async (q) => {
                if (!form.party_type) return { items: [] }
                const items = await bankAccountService.searchLink(form.party_type, q)
                return { items }
              }}
              validate={async (v) => {
                if (!form.party_type) return
                await bankAccountService.validateLink(form.party_type, v)
              }}
              docType={form.party_type || "Party"}
              placeholder="Select party…"
              suppressExternalLabelFetch
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Bank Account Type</label>
          <LinkSearchField
            value={form.account_type}
            onChange={(v) => set({ account_type: v ?? "" })}
            searchFn={async (q) => {
              const items = await bankAccountService.searchLink("Bank Account Type", q)
              return { items }
            }}
            docType="Bank Account Type"
            placeholder="Chequing, Savings…"
            suppressExternalLabelFetch
          />
        </div>
        <div>
          <label className={labelClass}>Bank Account Subtype</label>
          <LinkSearchField
            value={form.account_subtype}
            onChange={(v) => set({ account_subtype: v ?? "" })}
            searchFn={async (q) => {
              const items = await bankAccountService.searchLink("Bank Account Subtype", q)
              return { items }
            }}
            docType="Bank Account Subtype"
            placeholder="Business, Personal…"
            suppressExternalLabelFetch
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Bank Account No.</label>
          <Input value={form.bank_account_no} onChange={(e) => set({ bank_account_no: e.target.value })} placeholder="xxxx-xxxx" />
        </div>
        <div>
          <label className={labelClass}>IBAN</label>
          <Input value={form.iban} onChange={(e) => set({ iban: e.target.value })} placeholder="IBAN" maxLength={34} />
        </div>
        <div>
          <label className={labelClass}>Branch Code</label>
          <Input value={form.branch_code} onChange={(e) => set({ branch_code: e.target.value })} placeholder="Branch / transit" />
        </div>
        <div>
          <label className={labelClass}>Last Integration Date</label>
          <Input type="date" value={form.last_integration_date} onChange={(e) => set({ last_integration_date: e.target.value })} />
        </div>
      </div>

      <div className="flex items-center gap-8">
        <label className="block text-sm font-medium text-body">
          Disabled
          <span className="block text-xs text-muted font-normal mt-0.5">Prevents further use of this account.</span>
        </label>
        <Switch checked={form.disabled} onChange={(v) => set({ disabled: v })} />
      </div>

      {submitting && <p className="text-xs text-muted">Saving…</p>}
    </form>
  )
})