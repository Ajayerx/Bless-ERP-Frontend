"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import {
  customerService,
  type CustomerDetail,
  type CustomerFormData,
  type AddressInput,
  type AllowedCompanyRow,
  type CreditLimitRow,
  type PartyAccountRow,
  type SalesTeamRow,
  type PortalUserRow,
} from "@/services";
import ChildTableGrid, {
  type GridColumn,
} from "@/components/ui/ChildTableGrid";

interface CustomerFormProps {
  customer?: CustomerDetail | null;
  onSaved: () => void;
  onCancel: () => void;
}

const TABS = [
  "Basic Info",
  "Address & Contact",
  "Tax",
  "Accounting",
  "Sales Team",
  "Settings",
  "Portal Users",
] as const;
type TabName = (typeof TABS)[number];

const emptyAddress: AddressInput = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
};

const emptyForm: CustomerFormData = {
  salutation: "",
  customer_name: "",
  customer_type: "Company",
  customer_group: "",
  territory: "",
  gender: "",
  account_manager: "",
  default_currency: "",
  default_bank_account: "",
  default_price_list: "",
  is_internal_customer: false,
  represents_company: "",
  market_segment: "",
  industry: "",
  website: "",
  language: "",
  customer_details: "",
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
  contactEmail: "",
  contactPhone: "",
  billingAddress: { ...emptyAddress },
  shippingAddress: { ...emptyAddress },
  companies: [],
  credit_limits: [],
  accounts: [],
  sales_team: [],
  portal_users: [],
};

function isBlankAddress(addr?: AddressInput): boolean {
  if (!addr) return true;
  return (
    !addr.address_line1.trim() && !addr.city.trim() && !addr.country.trim()
  );
}

export default function CustomerForm({
  customer,
  onSaved,
  onCancel,
}: CustomerFormProps) {
  const isEdit = !!customer;
  const [activeTab, setActiveTab] = useState<TabName>("Basic Info");
  const [form, setForm] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ---- lookup option lists ----
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [customerGroups, setCustomerGroups] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);
  const [salutations, setSalutations] = useState<string[]>([]);
  const [genders, setGenders] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [bankAccounts, setBankAccounts] = useState<string[]>([]);
  const [priceLists, setPriceLists] = useState<string[]>([]);
  const [companiesOptions, setCompaniesOptions] = useState<string[]>([]);
  const [marketSegments, setMarketSegments] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [taxCategories, setTaxCategories] = useState<string[]>([]);
  const [taxWithholdingCategories, setTaxWithholdingCategories] = useState<
    string[]
  >([]);
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<string[]>(
    [],
  );
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<string[]>([]);
  const [salesPartners, setSalesPartners] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [salesPersons, setSalesPersons] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadLookups() {
      setLoadingLookups(true);
      try {
        const [
          groups,
          terrs,
          saluts,
          gends,
          currs,
          banks,
          prices,
          comps,
          segments,
          inds,
          langs,
          taxCats,
          taxWithCats,
          payTerms,
          loyalty,
          partners,
          accts,
          sPersons,
          usrs,
        ] = await Promise.all([
          customerService.lookups.customerGroups(),
          customerService.lookups.territories(),
          customerService.lookups.salutations(),
          customerService.lookups.genders(),
          customerService.lookups.currencies(),
          customerService.lookups.bankAccounts(),
          customerService.lookups.priceLists(),
          customerService.lookups.companies(),
          customerService.lookups.marketSegments(),
          customerService.lookups.industries(),
          customerService.lookups.languages(),
          customerService.lookups.taxCategories(),
          customerService.lookups.taxWithholdingCategories(),
          customerService.lookups.paymentTermsTemplates(),
          customerService.lookups.loyaltyPrograms(),
          customerService.lookups.salesPartners(),
          customerService.lookups.accounts(),
          customerService.lookups.salesPersons(),
          customerService.lookups.users(),
        ]);
        if (cancelled) return;
        setCustomerGroups(groups);
        setTerritories(terrs);
        setSalutations(saluts);
        setGenders(gends);
        setCurrencies(currs);
        setBankAccounts(banks);
        setPriceLists(prices);
        setCompaniesOptions(comps);
        setMarketSegments(segments);
        setIndustries(inds);
        setLanguages(langs);
        setTaxCategories(taxCats);
        setTaxWithholdingCategories(taxWithCats);
        setPaymentTermsTemplates(payTerms);
        setLoyaltyPrograms(loyalty);
        setSalesPartners(partners);
        setAccounts(accts);
        setSalesPersons(sPersons);
        setUsers(usrs);
      } catch {
        if (!cancelled) setError("Failed to load dropdown options.");
      } finally {
        if (!cancelled) setLoadingLookups(false);
      }
    }
    loadLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customer) {
      setForm(emptyForm);
      return;
    }
    const billing = customer.addresses.find(
      (a) => a.address_type === "Billing",
    );
    const shipping = customer.addresses.find(
      (a) => a.address_type === "Shipping",
    );

    setForm({
      salutation: customer.salutation ?? "",
      customer_name: customer.customer_name,
      customer_type: customer.customer_type,
      customer_group: customer.customer_group,
      territory: customer.territory,
      gender: customer.gender ?? "",
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
      contactEmail: customer.email_id ?? "",
      contactPhone: customer.mobile_no ?? "",
      billingAddress: billing
        ? {
            address_line1: billing.address_line1,
            address_line2: billing.address_line2 ?? "",
            city: billing.city,
            state: billing.state ?? "",
            country: billing.country,
            pincode: billing.pincode ?? "",
          }
        : { ...emptyAddress },
      shippingAddress: shipping
        ? {
            address_line1: shipping.address_line1,
            address_line2: shipping.address_line2 ?? "",
            city: shipping.city,
            state: shipping.state ?? "",
            country: shipping.country,
            pincode: shipping.pincode ?? "",
          }
        : { ...emptyAddress },
      existingContactName: customer.customer_primary_contact,
      existingBillingAddressName: billing?.name,
      existingShippingAddressName: shipping?.name,
      companies: customer.companies ?? [],
      credit_limits: customer.credit_limits ?? [],
      accounts: customer.accounts ?? [],
      sales_team: customer.sales_team ?? [],
      portal_users: customer.portal_users ?? [],
    });
  }, [customer]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? Number(value)
            : value,
    }));
  };

  const handleAddressChange = (
    which: "billingAddress" | "shippingAddress",
    field: keyof AddressInput,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [which]: { ...(prev[which] ?? emptyAddress), [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.customer_name.trim()) {
      setError("Customer name is required.");
      setActiveTab("Basic Info");
      return;
    }
    if (!form.customer_group) {
      setError("Customer group is required.");
      setActiveTab("Basic Info");
      return;
    }
    if (!form.territory) {
      setError("Territory is required.");
      setActiveTab("Basic Info");
      return;
    }

    const payload: CustomerFormData = {
      ...form,
      billingAddress: isBlankAddress(form.billingAddress)
        ? undefined
        : form.billingAddress,
      shippingAddress: isBlankAddress(form.shippingAddress)
        ? undefined
        : form.shippingAddress,
    };

    setSaving(true);
    try {
      if (isEdit && customer) {
        await customerService.update(customer.name, payload);
      } else {
        await customerService.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save customer. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200";
  const labelClass =
    "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider";

  // reusable Link-field <select>
  const LinkSelect = ({
    name,
    value,
    options,
    placeholder = "Select…",
  }: {
    name: string;
    value: string | undefined;
    options: string[];
    placeholder?: string;
  }) => (
    <select
      name={name}
      value={value ?? ""}
      onChange={handleChange}
      className={inputClass}
      disabled={loadingLookups}
    >
      <option value="">{loadingLookups ? "Loading…" : placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      {/* Tab switcher — self-contained, not dependent on ui/tabs.tsx (unseen in this chat) */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-px">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              "px-3 py-2 text-sm font-semibold rounded-t-[10px] transition-colors " +
              (activeTab === tab
                ? "text-primary-600 border-b-2 border-primary-600"
                : "text-muted hover:text-body")
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ---------------- Basic Info ---------------- */}
      {activeTab === "Basic Info" && (
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="col-span-2">
            <label htmlFor="customer_name" className={labelClass}>
              Customer Name *
            </label>
            <input
              id="customer_name"
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Acme Corp"
            />
          </div>
          <div>
            <label className={labelClass}>Salutation</label>
            <LinkSelect
              name="salutation"
              value={form.salutation}
              options={salutations}
            />
          </div>
          <div>
            <label htmlFor="customer_type" className={labelClass}>
              Customer Type
            </label>
            <select
              id="customer_type"
              name="customer_type"
              value={form.customer_type}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="Company">Company</option>
              <option value="Individual">Individual</option>
              <option value="Partnership">Partnership</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Customer Group *</label>
            <LinkSelect
              name="customer_group"
              value={form.customer_group}
              options={customerGroups}
              placeholder="Select a group"
            />
          </div>
          <div>
            <label className={labelClass}>Territory *</label>
            <LinkSelect
              name="territory"
              value={form.territory}
              options={territories}
              placeholder="Select a territory"
            />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <LinkSelect name="gender" value={form.gender} options={genders} />
          </div>
          <div>
            <label className={labelClass}>Account Manager</label>
            <LinkSelect
              name="account_manager"
              value={form.account_manager}
              options={users}
            />
          </div>

          <div className="col-span-2 pt-3 mt-1 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">Defaults</p>
          </div>
          <div>
            <label className={labelClass}>Billing Currency</label>
            <LinkSelect
              name="default_currency"
              value={form.default_currency}
              options={currencies}
            />
          </div>
          <div>
            <label className={labelClass}>Default Bank Account</label>
            <LinkSelect
              name="default_bank_account"
              value={form.default_bank_account}
              options={bankAccounts}
            />
          </div>
          <div>
            <label className={labelClass}>Default Price List</label>
            <LinkSelect
              name="default_price_list"
              value={form.default_price_list}
              options={priceLists}
            />
          </div>

          <div className="col-span-2 pt-3 mt-1 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">
              Internal Customer
            </p>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              id="is_internal_customer"
              name="is_internal_customer"
              type="checkbox"
              checked={!!form.is_internal_customer}
              onChange={handleChange}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="is_internal_customer" className="text-sm text-body">
              Is Internal Customer
            </label>
          </div>
          {form.is_internal_customer && (
            <>
              <div>
                <label className={labelClass}>Represents Company</label>
                <LinkSelect
                  name="represents_company"
                  value={form.represents_company}
                  options={companiesOptions}
                />
              </div>
              <ChildTableGrid<AllowedCompanyRow>
                title="Allowed To Transact With"
                rows={form.companies ?? []}
                onChange={(rows) =>
                  setForm((prev) => ({ ...prev, companies: rows }))
                }
                emptyRow={{ company: "" }}
                columns={
                  [
                    {
                      key: "company",
                      label: "Company",
                      type: "link",
                      options: companiesOptions,
                    },
                  ] as GridColumn<AllowedCompanyRow>[]
                }
              />
            </>
          )}

          <div className="col-span-2 pt-3 mt-1 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">
              More Information
            </p>
          </div>
          <div>
            <label className={labelClass}>Market Segment</label>
            <LinkSelect
              name="market_segment"
              value={form.market_segment}
              options={marketSegments}
            />
          </div>
          <div>
            <label className={labelClass}>Industry</label>
            <LinkSelect
              name="industry"
              value={form.industry}
              options={industries}
            />
          </div>
          <div>
            <label htmlFor="website" className={labelClass}>
              Website
            </label>
            <input
              id="website"
              name="website"
              value={form.website}
              onChange={handleChange}
              className={inputClass}
              placeholder="https://acmecorp.com"
            />
          </div>
          <div>
            <label className={labelClass}>Print Language</label>
            <LinkSelect
              name="language"
              value={form.language}
              options={languages}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="customer_details" className={labelClass}>
              Customer Details
            </label>
            <textarea
              id="customer_details"
              name="customer_details"
              value={form.customer_details}
              onChange={handleChange}
              rows={2}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* ---------------- Address & Contact ---------------- */}
      {activeTab === "Address & Contact" && (
        <div className="space-y-6 pt-2">
          <div>
            <p className="text-sm font-semibold text-heading mb-3">
              Primary Contact
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactEmail" className={labelClass}>
                  Email
                </label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {(["billingAddress", "shippingAddress"] as const).map((which) => (
            <div key={which} className="pt-4 border-t border-border">
              <p className="text-sm font-semibold text-heading mb-3">
                {which === "billingAddress"
                  ? "Billing Address"
                  : "Shipping Address"}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Address Line 1</label>
                  <input
                    value={form[which]?.address_line1 ?? ""}
                    onChange={(e) =>
                      handleAddressChange(
                        which,
                        "address_line1",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Address Line 2</label>
                  <input
                    value={form[which]?.address_line2 ?? ""}
                    onChange={(e) =>
                      handleAddressChange(
                        which,
                        "address_line2",
                        e.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input
                    value={form[which]?.city ?? ""}
                    onChange={(e) =>
                      handleAddressChange(which, "city", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State / Province</label>
                  <input
                    value={form[which]?.state ?? ""}
                    onChange={(e) =>
                      handleAddressChange(which, "state", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <input
                    value={form[which]?.country ?? ""}
                    onChange={(e) =>
                      handleAddressChange(which, "country", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Postal Code</label>
                  <input
                    value={form[which]?.pincode ?? ""}
                    onChange={(e) =>
                      handleAddressChange(which, "pincode", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Tax ---------------- */}
      {activeTab === "Tax" && (
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <label htmlFor="tax_id" className={labelClass}>
              Tax ID
            </label>
            <input
              id="tax_id"
              name="tax_id"
              value={form.tax_id}
              onChange={handleChange}
              className={inputClass}
              placeholder="XX-XXXXXXX"
            />
          </div>
          <div>
            <label className={labelClass}>Tax Category</label>
            <LinkSelect
              name="tax_category"
              value={form.tax_category}
              options={taxCategories}
            />
          </div>
          <div>
            <label className={labelClass}>Tax Withholding Category</label>
            <LinkSelect
              name="tax_withholding_category"
              value={form.tax_withholding_category}
              options={taxWithholdingCategories}
            />
          </div>
        </div>
      )}

      {/* ---------------- Accounting ---------------- */}
      {activeTab === "Accounting" && (
        <div className="space-y-6 pt-2">
          <div>
            <label className={labelClass}>Default Payment Terms Template</label>
            <LinkSelect
              name="payment_terms"
              value={form.payment_terms}
              options={paymentTermsTemplates}
            />
          </div>
          <ChildTableGrid<CreditLimitRow>
            title="Credit Limits"
            rows={form.credit_limits ?? []}
            onChange={(rows) =>
              setForm((prev) => ({ ...prev, credit_limits: rows }))
            }
            emptyRow={{
              company: "",
              credit_limit: 0,
              bypass_credit_limit_check: 0,
            }}
            columns={
              [
                {
                  key: "company",
                  label: "Company",
                  type: "link",
                  options: companiesOptions,
                },
                { key: "credit_limit", label: "Credit Limit", type: "number" },
                {
                  key: "bypass_credit_limit_check",
                  label: "Bypass Check",
                  type: "checkbox",
                },
              ] as GridColumn<CreditLimitRow>[]
            }
          />
          <ChildTableGrid<PartyAccountRow>
            title="Default Accounts"
            rows={form.accounts ?? []}
            onChange={(rows) =>
              setForm((prev) => ({ ...prev, accounts: rows }))
            }
            emptyRow={{ company: "", account: "", advance_account: "" }}
            columns={
              [
                {
                  key: "company",
                  label: "Company",
                  type: "link",
                  options: companiesOptions,
                },
                {
                  key: "account",
                  label: "Default Account",
                  type: "link",
                  options: accounts,
                },
                {
                  key: "advance_account",
                  label: "Advance Account",
                  type: "link",
                  options: accounts,
                },
              ] as GridColumn<PartyAccountRow>[]
            }
          />
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">
              Loyalty Points
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Loyalty Program</label>
                <LinkSelect
                  name="loyalty_program"
                  value={form.loyalty_program}
                  options={loyaltyPrograms}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Sales Team ---------------- */}
      {activeTab === "Sales Team" && (
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Sales Partner</label>
              <LinkSelect
                name="default_sales_partner"
                value={form.default_sales_partner}
                options={salesPartners}
              />
            </div>
            <div>
              <label htmlFor="default_commission_rate" className={labelClass}>
                Commission Rate
              </label>
              <input
                id="default_commission_rate"
                name="default_commission_rate"
                type="number"
                value={form.default_commission_rate ?? 0}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
          <ChildTableGrid<SalesTeamRow>
            title="Sales Team"
            rows={form.sales_team ?? []}
            onChange={(rows) =>
              setForm((prev) => ({ ...prev, sales_team: rows }))
            }
            emptyRow={{
              sales_person: "",
              contact_no: "",
              allocated_percentage: 0,
              incentives: 0,
            }}
            columns={
              [
                {
                  key: "sales_person",
                  label: "Sales Person",
                  type: "link",
                  options: salesPersons,
                },
                { key: "contact_no", label: "Contact No.", type: "text" },
                {
                  key: "allocated_percentage",
                  label: "Contribution %",
                  type: "number",
                },
                {
                  key: "allocated_amount",
                  label: "Contribution Amt",
                  type: "readonly",
                },
                {
                  key: "commission_rate",
                  label: "Commission Rate",
                  type: "readonly",
                },
                { key: "incentives", label: "Incentives", type: "number" },
              ] as GridColumn<SalesTeamRow>[]
            }
          />
        </div>
      )}

      {/* ---------------- Settings ---------------- */}
      {activeTab === "Settings" && (
        <div className="space-y-3 pt-2">
          {[
            {
              name: "so_required",
              label: "Allow Sales Invoice Creation Without Sales Order",
            },
            {
              name: "dn_required",
              label: "Allow Sales Invoice Creation Without Delivery Note",
            },
            { name: "is_frozen", label: "Is Frozen" },
            { name: "disabled", label: "Disabled (customer is inactive)" },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-2">
              <input
                id={f.name}
                name={f.name}
                type="checkbox"
                checked={!!form[f.name as keyof CustomerFormData]}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor={f.name} className="text-sm text-body">
                {f.label}
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Portal Users ---------------- */}
      {activeTab === "Portal Users" && (
        <div className="pt-2">
          <ChildTableGrid<PortalUserRow>
            title="Portal Users"
            rows={form.portal_users ?? []}
            onChange={(rows) =>
              setForm((prev) => ({ ...prev, portal_users: rows }))
            }
            emptyRow={{ user: "" }}
            columns={
              [
                { key: "user", label: "User", type: "link", options: users },
              ] as GridColumn<PortalUserRow>[]
            }
          />
        </div>
      )}

      {/* Actions — always visible regardless of active tab */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || loadingLookups}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saving
            ? "Saving..."
            : isEdit
              ? "Update Customer"
              : "Create Customer"}
        </button>
      </div>
    </form>
  );
}
