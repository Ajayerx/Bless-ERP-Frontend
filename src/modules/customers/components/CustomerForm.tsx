"use client";

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import {
  customerService,
  searchLink,
  validateLink,
  type CustomerDetail,
  type CustomerFormData,
  type AllowedCompanyRow,
  type CreditLimitRow,
  type PartyAccountRow,
  type SalesTeamRow,
  type PortalUserRow,
} from "@/services";
import { apiClient } from "@/services/api-client";
import ChildTableGrid, {
  type GridColumn,
} from "@/components/ui/ChildTableGrid";
import { Input, FormField, Select, Checkbox, Tabs, TabsList, TabsTrigger, TabsContent, LinkSearchField } from "@/components/ui";

interface CustomerFormProps {
  customer?: CustomerDetail | null;
  initialValues?: Partial<CustomerFormData>;
  onSaved?: (name: string) => void;
  onSavingChange?: (saving: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

// Imperative handle so the header Save/Update button (outside the <form>) can
// trigger the same create/update flow as the form's own submit button.
export interface CustomerFormHandle {
  save: () => Promise<string | undefined>
  isDirty: () => boolean
}

const TABS = [
  "Details",
  "Address & Contact",
  "Tax",
  "Accounting",
  "Sales Team",
  "Settings",
  "Portal Users",
] as const;
type TabName = (typeof TABS)[number];

const emptyForm: CustomerFormData = {
  salutation: "",
  customer_name: "",
  customer_type: "Company",
  customer_group: "",
  territory: "",
  gender: "",
  lead_name: "",
  opportunity_name: "",
  prospect_name: "",
  account_manager: "",
  default_currency: "",
  default_bank_account: "",
  default_price_list: "",
  is_internal_customer: false,
  represents_company: "",
  market_segment: "",
  industry: "",
  website: "",
  language: "en-US",
  customer_details: "",
  customer_primary_contact: "",
  customer_primary_address: "",
  primary_address: "",
  mobile_no: "",
  email_id: "",
  tax_id: "",
  tax_category: "",
  tax_withholding_category: "",
  payment_terms: "",
  loyalty_program: "",
  default_sales_partner: "",
  default_commission_rate: 0,
  so_required: false,
  dn_required: false,
  is_frozen: false,
  disabled: false,
  companies: [],
  credit_limits: [],
  accounts: [],
  sales_team: [],
  portal_users: [],
};



export default forwardRef<CustomerFormHandle, CustomerFormProps>(function CustomerForm({
  customer,
  initialValues,
  onSaved,
  onSavingChange,
  onDirtyChange,
}: CustomerFormProps, ref) {
  const isEdit = !!customer;
  const [activeTab, setActiveTab] = useState<TabName>("Details");
  const [form, setForm] = useState<CustomerFormData>(emptyForm);
  const [error, setError] = useState("");
  // Baseline snapshot of the loaded values; dirty = current form != baseline.
  const baselineRef = useRef<string>("");

  const customerTypeOptions = ["Company", "Individual", "Partnership"];

  const setDirty = useCallback((dirty: boolean) => {
    onDirtyChange?.(dirty);
  }, [onDirtyChange]);

  useEffect(() => {
    setDirty(JSON.stringify(form) !== baselineRef.current);
  }, [form, setDirty]);

  const applyLoaded = useCallback((next: CustomerFormData) => {
    setForm(next);
    baselineRef.current = JSON.stringify(next);
    setDirty(false);
  }, [setDirty]);

  useEffect(() => {
    if (!customer) {
      applyLoaded(initialValues ? { ...emptyForm, ...initialValues } : emptyForm);
      return;
    }
    applyLoaded({
      salutation: customer.salutation ?? "",
      customer_name: customer.customer_name,
      customer_type: customer.customer_type,
      customer_group: customer.customer_group,
      territory: customer.territory,
      gender: customer.gender ?? "",
      lead_name: customer.lead_name ?? "",
      opportunity_name: customer.opportunity_name ?? "",
      prospect_name: customer.prospect_name ?? "",
      account_manager: customer.account_manager ?? "",
      default_currency: customer.default_currency ?? "",
      default_bank_account: customer.default_bank_account ?? "",
      default_price_list: customer.default_price_list ?? "",
      is_internal_customer: !!customer.is_internal_customer,
      represents_company: customer.represents_company ?? "",
      market_segment: customer.market_segment ?? "",
      industry: customer.industry ?? "",
      website: customer.website ?? "",
      language: customer.language ?? "",
      customer_details: customer.customer_details ?? "",
      customer_primary_contact: customer.customer_primary_contact ?? "",
      customer_primary_address: customer.customer_primary_address ?? "",
      primary_address: customer.primary_address ?? "",
      mobile_no: customer.mobile_no ?? "",
      email_id: customer.email_id ?? "",
      tax_id: customer.tax_id ?? "",
      tax_category: customer.tax_category ?? "",
      tax_withholding_category: customer.tax_withholding_category ?? "",
      payment_terms: customer.payment_terms ?? "",
      loyalty_program: customer.loyalty_program ?? "",
      default_sales_partner: customer.default_sales_partner ?? "",
      default_commission_rate: customer.default_commission_rate ?? 0,
      so_required: !!customer.so_required,
      dn_required: !!customer.dn_required,
      is_frozen: !!customer.is_frozen,
      disabled: !!customer.disabled,
      companies: customer.companies ?? [],
      credit_limits: customer.credit_limits ?? [],
      accounts: customer.accounts ?? [],
      sales_team: customer.sales_team ?? [],
      portal_users: customer.portal_users ?? [],
    });
  }, [customer, initialValues, applyLoaded]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleLinkChange = (field: string) => (value: string | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));
  };

  const handleLeadChange = async (value: string | undefined) => {
    setForm((prev) => ({ ...prev, lead_name: value ?? "" }));
    if (value) {
      try {
        const lead = await apiClient<{ company_name?: string; lead_name?: string }>(
          `/resource/Lead/${encodeURIComponent(value)}?fields=["company_name","lead_name"]`
        );
        setForm((prev) => {
          if (prev.customer_name && prev.customer_name !== prev.lead_name) return prev;
          return { ...prev, customer_name: lead.company_name || lead.lead_name || "" };
        });
      } catch {
        // Lead fetch failed — do nothing
      }
    }
  };

  const handleLinkWithFetch = (field: string, fetchDocType: string, fetchFields: string[], targetMap: Record<string, string>) => async (value: string | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value ?? "" }));
    if (value) {
      try {
        const doc = await apiClient<Record<string, unknown>>(
          `/resource/${fetchDocType}/${encodeURIComponent(value)}?fields=${JSON.stringify(fetchFields)}`
        );
        setForm((prev) => {
          const updates: Record<string, unknown> = {};
          for (const [targetField, sourceField] of Object.entries(targetMap)) {
            updates[targetField] = (doc as any)?.[sourceField] ?? "";
          }
          return { ...prev, ...updates };
        });
      } catch {
        // fetch failed — do nothing
      }
    }
  };

  const handlePrimaryContactChange = (value: string | undefined) => {
    setForm((prev) => ({ ...prev, customer_primary_contact: value ?? "" }));
    if (!value) {
      setForm((prev) => ({ ...prev, mobile_no: "", email_id: "" }));
    }
  };

  const handleLoyaltyProgramChange = (value: string | undefined) => {
    setForm((prev) => {
      if (prev.loyalty_program && value !== prev.loyalty_program) {
        return { ...prev, loyalty_program: value ?? "", loyalty_program_tier: "" };
      }
      return { ...prev, loyalty_program: value ?? "" };
    });
  };

  const handlePrimaryAddressChange = async (value: string | undefined) => {
    setForm((prev) => ({ ...prev, customer_primary_address: value ?? "" }));
    if (value) {
      try {
        const display = await apiClient<string>(
          `/method/frappe.contacts.doctype.address.address.get_address_display?address_dict=${encodeURIComponent(value)}`
        );
        setForm((prev) => ({ ...prev, primary_address: display ?? "" }));
      } catch {
        // failed — do nothing
      }
    } else {
      setForm((prev) => ({ ...prev, primary_address: "" }));
    }
  };

  // Shared save flow used both by the form submit and the imperative handle.
  const save = useCallback(async (): Promise<string | undefined> => {
    setError("");

    if (!form.customer_name.trim()) {
      setError("Customer name is required.");
      return undefined;
    }

    if (form.is_internal_customer && !form.represents_company) {
      setError("Represents Company is required when Is Internal Customer is checked.");
      return undefined;
    }

    if (form.sales_team && form.sales_team.length > 0) {
      const total = form.sales_team.reduce(
        (sum, row) => sum + (row.allocated_percentage || 0), 0,
      );
      if (total !== 100) {
        setError(`Total contribution percentage should be equal to 100 (currently ${total}%).`);
        setActiveTab("Sales Team");
        return undefined;
      }
    }

    const payload: CustomerFormData = {
      ...form,
      customer_name: form.customer_name.trim(),
    };

    onSavingChange?.(true);
    try {
      let savedName: string | undefined;
      if (isEdit && customer) {
        await customerService.update(customer.name, payload);
        savedName = customer.name;
      } else {
        const created = await customerService.create(payload);
        savedName = created.name;
      }
      onSaved?.(savedName ?? "");
      return savedName;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save customer. Please try again.",
      );
      return undefined;
    } finally {
      onSavingChange?.(false);
    }
  }, [form, customer, isEdit, onSaved, onSavingChange]);

  useImperativeHandle(ref, () => ({
    save,
    isDirty: () => JSON.stringify(form) !== baselineRef.current,
  }), [form, save, baselineRef]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  const sectionTitle = "text-base font-bold text-heading mb-3";
  const sectionDivider = "pt-4 border-t border-border";

  return (
    <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabName)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Details">
          <div className="space-y-6">
        {/* Section: Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          {(() => {
            const leftFields: ({ key: string; visible: boolean; render: () => React.ReactNode })[] = [
              { key: "salutation", visible: form.customer_type !== "Company", render: () => (
                <FormField label="Salutation">
                  <LinkSearchField
                    value={form.salutation}
                    onChange={handleLinkChange("salutation")}
                    searchFn={(q) => searchLink("Salutation", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Salutation", v)}
                    docType="Salutation"
                  />
                </FormField>
              )},
              { key: "customer_name", visible: true, render: () => (
                <Input
                  id="customer_name"
                  name="customer_name"
                  label="Customer Name"
                  required
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Acme Corp"
                  className="font-bold"
                />
              )},
              { key: "customer_type", visible: true, render: () => (
                <FormField label="Customer Type" required>
                  <Select name="customer_type" value={form.customer_type} onChange={handleChange}>
                    {customerTypeOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </FormField>
              )},
              { key: "customer_group", visible: true, render: () => (
                <FormField label="Customer Group">
                  <LinkSearchField
                    value={form.customer_group}
                    onChange={handleLinkChange("customer_group")}
                    searchFn={(q) => searchLink("Customer Group", q, undefined, [["is_group", "=", 0]]).then((items) => ({ items }))}
                    validate={(v) => validateLink("Customer Group", v)}
                    docType="Customer Group"
                  />
                </FormField>
              )},
            ];
            const rightFields: ({ key: string; visible: boolean; render: () => React.ReactNode })[] = [
              { key: "territory", visible: true, render: () => (
                <FormField label="Territory">
                  <LinkSearchField
                    value={form.territory}
                    onChange={handleLinkChange("territory")}
                    searchFn={(q) => searchLink("Territory", q, undefined, [["is_group", "=", 0]]).then((items) => ({ items }))}
                    validate={(v) => validateLink("Territory", v)}
                    docType="Territory"
                  />
                </FormField>
              )},
              { key: "gender", visible: form.customer_type !== "Company", render: () => (
                <FormField label="Gender">
                  <LinkSearchField
                    value={form.gender}
                    onChange={handleLinkChange("gender")}
                    searchFn={(q) => searchLink("Gender", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Gender", v)}
                    docType="Gender"
                  />
                </FormField>
              )},
              { key: "lead_name", visible: true, render: () => (
                <FormField label="From Lead">
                  <LinkSearchField
                    value={form.lead_name}
                    onChange={handleLeadChange}
                    searchFn={(q) => searchLink("Lead", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Lead", v)}
                    docType="Lead"
                  />
                </FormField>
              )},
              { key: "opportunity_name", visible: true, render: () => (
                <FormField label="From Opportunity">
                  <LinkSearchField
                    value={form.opportunity_name}
                    onChange={handleLinkChange("opportunity_name")}
                    searchFn={(q) => searchLink("Opportunity", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Opportunity", v)}
                    docType="Opportunity"
                  />
                </FormField>
              )},
              { key: "prospect_name", visible: true, render: () => (
                <FormField label="From Prospect">
                  <LinkSearchField
                    value={form.prospect_name}
                    onChange={handleLinkChange("prospect_name")}
                    searchFn={(q) => searchLink("Prospect", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Prospect", v)}
                    docType="Prospect"
                  />
                </FormField>
              )},
              { key: "account_manager", visible: true, render: () => (
                <FormField label="Account Manager">
                  <LinkSearchField
                    value={form.account_manager}
                    onChange={handleLinkChange("account_manager")}
                    searchFn={(q) => searchLink("User", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("User", v)}
                    docType="User"
                  />
                </FormField>
              )},
            ];
            const visibleLeft = leftFields.filter((f) => f.visible);
            const visibleRight = rightFields.filter((f) => f.visible);
            const maxRows = Math.max(visibleLeft.length, visibleRight.length);
            const rows: React.ReactNode[] = [];
            for (let i = 0; i < maxRows; i++) {
              rows.push(
                <React.Fragment key={i}>
                  {visibleLeft[i] ? visibleLeft[i].render() : <div />}
                  {visibleRight[i] ? visibleRight[i].render() : <div />}
                </React.Fragment>
              );
            }
            return rows;
          })()}
        </div>

        {/* Section: Defaults */}
        <div className={sectionDivider}>
          <p className={sectionTitle}>Defaults</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Billing Currency">
              <LinkSearchField
                value={form.default_currency}
                onChange={handleLinkChange("default_currency")}
                searchFn={(q) => searchLink("Currency", q).then((items) => ({ items }))}
                validate={(v) => validateLink("Currency", v)}
                docType="Currency"
              />
            </FormField>
            <FormField label="Default Price List">
              <LinkSearchField
                value={form.default_price_list}
                onChange={handleLinkChange("default_price_list")}
                searchFn={(q) => searchLink("Price List", q, undefined, [["selling", "=", 1]]).then((items) => ({ items }))}
                validate={(v) => validateLink("Price List", v)}
                docType="Price List"
              />
            </FormField>
            <FormField label="Default Company Bank Account">
              <LinkSearchField
                value={form.default_bank_account}
                onChange={handleLinkChange("default_bank_account")}
                searchFn={(q) => searchLink("Bank Account", q, undefined, [["is_company_account", "=", 1]]).then((items) => ({ items }))}
                validate={(v) => validateLink("Bank Account", v)}
                docType="Bank Account"
              />
            </FormField>
            <div />
          </div>
        </div>

        {/* Section: Internal Customer (collapsible, auto-opens when checked) */}
        <details className={sectionDivider} open={!!form.is_internal_customer}>
          <summary className={sectionTitle + " cursor-pointer select-none hover:text-heading"} style={{ listStyle: "none" }}>
            <span className="mr-1">{form.is_internal_customer ? "▾" : "▸"}</span>
            Internal Customer
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Checkbox
              id="is_internal_customer"
              checked={!!form.is_internal_customer}
              onCheckedChange={(checked) =>
                setForm((prev) => {
                  const next = { ...prev, is_internal_customer: !!checked };
                  if (!checked) { next.represents_company = ""; next.companies = []; }
                  return next;
                })
              }
              label="Is Internal Customer"
            />
            <div />
            {form.is_internal_customer && (
              <FormField label="Represents Company">
                <LinkSearchField
                  value={form.represents_company}
                  onChange={handleLinkChange("represents_company")}
                  searchFn={(q) => searchLink("Company", q).then((items) => ({ items }))}
                  validate={(v) => validateLink("Company", v)}
                  docType="Company"
                />
              </FormField>
            )}
            {form.is_internal_customer && !!form.represents_company && (
              <ChildTableGrid<AllowedCompanyRow>
                title="Allowed to Transact With"
                rows={form.companies ?? []}
                onChange={(rows) => setForm((prev) => ({ ...prev, companies: rows }))}
                emptyRow={{ company: "" }}
                columns={[{ key: "company", label: "Company", type: "link", docType: "Company", searchFn: (q) => searchLink("Company", q).then((items) => ({ items })), validate: (v) => validateLink("Company", v) }] as GridColumn<AllowedCompanyRow>[]}
              />
            )}
          </div>
        </details>

        {/* Section: More Information (collapsible) */}
        <details className={sectionDivider} open={!!form.customer_details}>
          <summary className={sectionTitle + " cursor-pointer select-none hover:text-heading"} style={{ listStyle: "none" }}>
            <span className="mr-1">{form.customer_details ? "▾" : "▸"}</span>
            More Information
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <FormField label="Market Segment">
                <LinkSearchField
                  value={form.market_segment}
                  onChange={handleLinkChange("market_segment")}
                  searchFn={(q) => searchLink("Market Segment", q).then((items) => ({ items }))}
                  validate={(v) => validateLink("Market Segment", v)}
                  docType="Market Segment"
                />
              </FormField>
              <FormField label="Industry">
                <LinkSearchField
                  value={form.industry}
                  onChange={handleLinkChange("industry")}
                  searchFn={(q) => searchLink("Industry Type", q).then((items) => ({ items }))}
                  validate={(v) => validateLink("Industry Type", v)}
                  docType="Industry Type"
                />
              </FormField>
              <FormField label="Website">
                <Input
                  id="website"
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://acmecorp.com"
                />
              </FormField>
              <FormField label="Print Language">
                <LinkSearchField
                  value={form.language}
                  onChange={handleLinkChange("language")}
                  searchFn={(q) => searchLink("Language", q).then((items) => ({ items }))}
                  validate={(v) => validateLink("Language", v)}
                  docType="Language"
                />
              </FormField>
            </div>
            <FormField label="Customer Details">
              <textarea
                id="customer_details"
                name="customer_details"
                value={form.customer_details}
                onChange={handleChange}
                rows={8}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-y h-full"
                placeholder="Internal notes about this customer..."
              />
            </FormField>
          </div>
        </details>
        </div>
        </TabsContent>

        {/* ---- Address & Contact ---- */}
        <TabsContent value="Address & Contact">
          {isEdit && customer && customer.addresses.length > 0 && (
            <div>
              <p className={sectionTitle}>Addresses</p>
              <div className="grid grid-cols-1 gap-3">
                {customer.addresses.map((addr) => (
                  <div key={addr.name} className="border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{addr.address_type}</span>
                      {addr.address_type === "Billing" && (
                        <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Billing</span>
                      )}
                      {addr.address_type === "Shipping" && (
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Shipping</span>
                      )}
                    </div>
                    <p className="text-sm text-body">
                      {[addr.address_line1, addr.address_line2, addr.city, addr.state, addr.country, addr.pincode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEdit && customer && customer.contacts.length > 0 && (
            <div className={customer.addresses.length > 0 ? sectionDivider : ""}>
              <p className={sectionTitle}>Contacts</p>
              <div className="grid grid-cols-1 gap-3">
                {customer.contacts.map((c) => (
                  <div key={c.name} className="border border-border rounded-xl p-4">
                    <p className="text-sm font-semibold text-heading">{c.first_name}{c.last_name ? ` ${c.last_name}` : ""}</p>
                    {c.email_id && <p className="text-xs text-muted mt-0.5">{c.email_id}</p>}
                    {c.mobile_no && <p className="text-xs text-muted">{c.mobile_no}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Primary Address and Contact — always visible */}
          <div className={isEdit && customer && (customer.addresses.length > 0 || customer.contacts.length > 0) ? sectionDivider : ""}>
            <p className={sectionTitle}>Primary Address and Contact</p>
            <p className="text-xs text-muted mb-3">Select, to make the customer searchable with these fields</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Customer Primary Address" helperText="Reselect, if the chosen address is edited after save">
                <LinkSearchField
                  value={form.customer_primary_address}
                  onChange={handlePrimaryAddressChange}
                  searchFn={(q) => {
                    const customerName = customer?.name ?? "";
                    return searchLink("Address", q, "Customer", { customer: customerName, type: "Address" }, "erpnext.selling.doctype.customer.customer.get_customer_primary").then((items) => ({ items }));
                  }}
                  validate={(v) => validateLink("Address", v)}
                  docType="Address"
                />
              </FormField>
              <FormField label="Customer Primary Contact" helperText="Reselect, if the chosen contact is edited after save">
                <LinkSearchField
                  value={form.customer_primary_contact}
                  onChange={handlePrimaryContactChange}
                  searchFn={(q) => {
                    const customerName = customer?.name ?? "";
                    return searchLink("Contact", q, "Customer", { customer: customerName, type: "Contact" }, "erpnext.selling.doctype.customer.customer.get_customer_primary").then((items) => ({ items }));
                  }}
                  validate={(v) => validateLink("Contact", v)}
                  docType="Contact"
                />
              </FormField>
            </div>
          </div>
        </TabsContent>

        {/* ---- Tax ---- */}
        <TabsContent value="Tax">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tax ID">
              <Input
                id="tax_id"
                name="tax_id"
                value={form.tax_id}
                onChange={handleChange}
                placeholder="XX-XXXXXXX"
              />
            </FormField>
            <FormField label="Tax Category">
              <LinkSearchField
                value={form.tax_category}
                onChange={handleLinkChange("tax_category")}
                searchFn={(q) => searchLink("Tax Category", q).then((items) => ({ items }))}
                validate={(v) => validateLink("Tax Category", v)}
                docType="Tax Category"
              />
            </FormField>
            <div />
            <FormField label="Tax Withholding Category">
              <LinkSearchField
                value={form.tax_withholding_category}
                onChange={handleLinkChange("tax_withholding_category")}
                searchFn={(q) => searchLink("Tax Withholding Category", q).then((items) => ({ items }))}
                validate={(v) => validateLink("Tax Withholding Category", v)}
                docType="Tax Withholding Category"
              />
            </FormField>
          </div>
        </TabsContent>

        {/* ---- Accounting ---- */}
        <TabsContent value="Accounting">
          <div className="space-y-6">
            <div>
              <p className={sectionTitle}>Credit Limit and Payment Terms</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormField label="Default Payment Terms Template">
                  <LinkSearchField
                    value={form.payment_terms}
                    onChange={handleLinkChange("payment_terms")}
                    searchFn={(q) => searchLink("Payment Terms Template", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Payment Terms Template", v)}
                    docType="Payment Terms Template"
                  />
                </FormField>
                <div />
              </div>
              <ChildTableGrid<CreditLimitRow>
                title="Credit Limit"
                rows={form.credit_limits ?? []}
                onChange={(rows) => {
                  const companies = rows.map((r) => r.company).filter(Boolean);
                  const dupes = companies.filter((c, i) => companies.indexOf(c) !== i);
                  if (dupes.length > 0) {
                    setError(`Duplicate credit limit for company: ${dupes.join(", ")}`);
                    return;
                  }
                  setError("");
                  setForm((prev) => ({ ...prev, credit_limits: rows }));
                }}
                emptyRow={{ company: "", credit_limit: 0, bypass_credit_limit_check: 0 }}
                columns={[
                  { key: "company", label: "Company", type: "link", docType: "Company", searchFn: (q) => searchLink("Company", q, "Customer Credit Limit").then((items) => ({ items })), validate: (v) => validateLink("Company", v) },
                  { key: "credit_limit", label: "Credit Limit", type: "number" },
                  { key: "bypass_credit_limit_check", label: "Bypass Credit Limit Check at Sales Order", type: "checkbox" },
                ] as GridColumn<CreditLimitRow>[]}
              />
            </div>

            <div className={sectionDivider}>
              <ChildTableGrid<PartyAccountRow>
                title="Default Accounts"
                description="Mention if non-standard Receivable account"
                rows={form.accounts ?? []}
                onChange={(rows) => setForm((prev) => ({ ...prev, accounts: rows }))}
                emptyRow={{ company: "", account: "" }}
                columns={[
                  { key: "company", label: "Company", type: "link", docType: "Company", searchFn: (q) => searchLink("Company", q, "Party Account", undefined, undefined, true).then((items) => ({ items })), validate: (v) => validateLink("Company", v) },
                  { key: "account", label: "Default Account", type: "link", docType: "Account", searchFn: (q) => searchLink("Account", q, undefined, [["account_type", "=", "Receivable"], ["root_type", "=", "Asset"], ["is_group", "=", 0]]).then((items) => ({ items })), validate: (v) => validateLink("Account", v) },
                ] as GridColumn<PartyAccountRow>[]}
              />
            </div>

            <details className={sectionDivider}>
              <summary className={sectionTitle + " cursor-pointer select-none hover:text-heading"} style={{ listStyle: "none" }}>
                <span className="mr-1">▸</span>
                Loyalty Points
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-4">
                <FormField label="Loyalty Program">
                  <LinkSearchField
                    value={form.loyalty_program}
                    onChange={handleLoyaltyProgramChange}
                    searchFn={(q) => searchLink("Loyalty Program", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Loyalty Program", v)}
                    docType="Loyalty Program"
                  />
                </FormField>
              </div>
            </details>
          </div>
        </TabsContent>

        {/* ---- Sales Team ---- */}
        <TabsContent value="Sales Team">
          <div className="space-y-6">
            <ChildTableGrid<SalesTeamRow>
              title="Sales Team"
              rows={form.sales_team ?? []}
              onChange={(rows) => setForm((prev) => ({ ...prev, sales_team: rows }))}
              emptyRow={{ sales_person: "", contact_no: "", allocated_percentage: 0, incentives: 0 }}
              columns={[
                { key: "sales_person", label: "Sales Person", type: "link", docType: "Sales Person", searchFn: (q) => searchLink("Sales Person", q).then((items) => ({ items })), validate: (v) => validateLink("Sales Person", v) },
                { key: "allocated_percentage", label: "Contribution %", type: "number" },
                { key: "commission_rate", label: "Commission Rate", type: "text" },
              ] as GridColumn<SalesTeamRow>[]}
            />

            <div className={sectionDivider}>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Sales Partner">
                  <LinkSearchField
                    value={form.default_sales_partner}
                    onChange={handleLinkWithFetch("default_sales_partner", "Sales Partner", ["commission_rate"], { default_commission_rate: "commission_rate" })}
                    searchFn={(q) => searchLink("Sales Partner", q).then((items) => ({ items }))}
                    validate={(v) => validateLink("Sales Partner", v)}
                    docType="Sales Partner"
                  />
                </FormField>
                <FormField label="Commission Rate (%)">
                  <Input
                    id="default_commission_rate"
                    name="default_commission_rate"
                    type="number"
                    value={form.default_commission_rate ?? 0}
                    onChange={handleChange}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---- Settings ---- */}
        <TabsContent value="Settings">
          <div className="grid grid-cols-2 gap-4">
            <Checkbox
              id="so_required"
              checked={!!form.so_required}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, so_required: !!checked }))}
              label="Allow Sales Invoice Creation Without Sales Order"
            />
            <Checkbox
              id="is_frozen"
              checked={!!form.is_frozen}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_frozen: !!checked }))}
              label="Is Frozen"
            />
            <Checkbox
              id="dn_required"
              checked={!!form.dn_required}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, dn_required: !!checked }))}
              label="Allow Sales Invoice Creation Without Delivery Note"
            />
            <Checkbox
              id="disabled"
              checked={!!form.disabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, disabled: !!checked }))}
              label="Disabled"
            />
          </div>
        </TabsContent>

        {/* ---- Portal Users ---- */}
        <TabsContent value="Portal Users">
          <ChildTableGrid<PortalUserRow>
            title="Customer Portal Users"
            rows={form.portal_users ?? []}
            onChange={(rows) => setForm((prev) => ({ ...prev, portal_users: rows }))}
            emptyRow={{ user: "" }}
            columns={[
              { key: "user", label: "User", type: "link", docType: "User", searchFn: (q) => searchLink("User", q, "Portal User", { ignore_user_type: true }).then((items) => ({ items })), validate: (v) => validateLink("User", v) },
            ] as GridColumn<PortalUserRow>[]}
          />
        </TabsContent>
      </Tabs>
    </form>
  );
});
