"use client"
import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { Input, Select as UiSelect } from "@/components/ui"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { apiClient } from "@/services/api-client"
import type {
  ContactFormData, Contact, ContactEmailRow, ContactPhoneRow,
} from "@/services"

interface Props {
  defaultValues?: Partial<Contact>
  onSubmit: (data: ContactFormData) => Promise<void>
  customerName?: string
}

export interface ContactFormRef {
  submit: () => void
}

function buildDefaultForm(customerName?: string): ContactFormData {
  return {
    first_name: "",
    middle_name: "",
    last_name: "",
    salutation: "",
    designation: "",
    gender: "",
    company_name: "",
    department: "",
    is_primary_contact: false,
    is_billing_contact: false,
    email_ids: [],
    phone_nos: [],
    links: customerName
      ? [{ link_doctype: "Customer", link_name: customerName }]
      : [],
  }
}

function contactToForm(c: Partial<Contact>, customerName?: string): ContactFormData {
  return {
    first_name: c.first_name ?? "",
    middle_name: c.middle_name ?? "",
    last_name: c.last_name ?? "",
    salutation: c.salutation ?? "",
    designation: c.designation ?? "",
    gender: c.gender ?? "",
    company_name: c.company_name ?? "",
    department: c.department ?? "",
    is_primary_contact: !!c.is_primary_contact,
    is_billing_contact: !!c.is_billing_contact,
    email_ids: c.email_ids ?? [],
    phone_nos: c.phone_nos ?? [],
    links: customerName
      ? [{ link_doctype: "Customer", link_name: customerName }]
      : (c.links ?? []),
  }
}

const emailCols: GridColumn<ContactEmailRow>[] = [
  { key: "email_id", label: "Email", type: "text" },
  { key: "is_primary", label: "Primary", type: "checkbox" },
]
const phoneCols: GridColumn<ContactPhoneRow>[] = [
  { key: "phone", label: "Phone", type: "text" },
  { key: "is_primary_mobile_no", label: "Primary", type: "checkbox" },
]

export default forwardRef<ContactFormRef, Props>(function ContactForm(
  { defaultValues, onSubmit, customerName },
  ref,
) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactFormData>({
    defaultValues: buildDefaultForm(customerName),
  })
  const [salutations, setSalutations] = useState<string[]>([])
  const [genders, setGenders] = useState<string[]>([])
  const [emailRows, setEmailRows] = useState<ContactEmailRow[]>([])
  const [phoneRows, setPhoneRows] = useState<ContactPhoneRow[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  useEffect(() => {
    async function load() {
      setLoadingLookups(true)
      try {
        const [sals, gends] = await Promise.all([
          loadOptions("Salutation"),
          loadOptions("Gender"),
        ])
        setSalutations(sals)
        setGenders(gends)
      } finally {
        setLoadingLookups(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (defaultValues) {
      const f = contactToForm(defaultValues, customerName)
      reset(f)
      setEmailRows(f.email_ids)
      setPhoneRows(f.phone_nos)
    }
  }, [defaultValues, customerName, reset])

  useImperativeHandle(ref, () => ({
    submit: handleSubmit((data) => {
      onSubmit({ ...data, email_ids: emailRows, phone_nos: phoneRows })
    }),
  }))

  const renderField = (field: string, label: string, type = "text", required?: boolean) => (
    <Input
      label={label}
      type={type}
      error={(errors as Record<string, { message?: string }>)[field]?.message}
      {...register(field as keyof ContactFormData, required ? { required: `${label} is required` } : undefined)}
    />
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <UiSelect label="Salutation" {...register("salutation")} disabled={loadingLookups}>
          <option value="">Select…</option>
          {salutations.map((s) => <option key={s} value={s}>{s}</option>)}
        </UiSelect>
        {renderField("first_name", "First Name", "text", true)}
        {renderField("middle_name", "Middle Name")}
        {renderField("last_name", "Last Name")}
        <UiSelect label="Gender" {...register("gender")} disabled={loadingLookups}>
          <option value="">Select…</option>
          {genders.map((g) => <option key={g} value={g}>{g}</option>)}
        </UiSelect>
        {renderField("designation", "Designation")}
        {renderField("company_name", "Company Name")}
        {renderField("department", "Department")}
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-heading">Contact Details</p>
        <div className="grid grid-cols-2 gap-4">
          {renderField("email_id", "Primary Email (convenience)")}
          {renderField("mobile_no", "Primary Mobile (convenience)")}
        </div>
      </div>

      <ChildTableGrid<ContactEmailRow>
        title="Email IDs"
        rows={emailRows}
        onChange={setEmailRows}
        emptyRow={{ email_id: "", is_primary: 0 }}
        columns={emailCols}
      />

      <ChildTableGrid<ContactPhoneRow>
        title="Phone Numbers"
        rows={phoneRows}
        onChange={setPhoneRows}
        emptyRow={{ phone: "", is_primary_mobile_no: 0 }}
        columns={phoneCols}
      />

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" {...register("is_primary_contact")} className="h-4 w-4 rounded border-border" />
          Is Primary Contact
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" {...register("is_billing_contact")} className="h-4 w-4 rounded border-border" />
          Is Billing Contact
        </label>
      </div>
    </div>
  )
})

async function loadOptions(doctype: string): Promise<string[]> {
  const rows = await apiClient<Array<{ name: string }>>(
    `/resource/${encodeURIComponent(doctype)}?fields=${encodeURIComponent(JSON.stringify(["name"]))}&order_by=name%20asc&limit_page_length=0`
  )
  return rows.map((r) => r.name)
}
