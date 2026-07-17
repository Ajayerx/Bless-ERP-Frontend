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
  type SupplierNumberRow,
} from "@/services";
import ChildTableGrid, {
  type GridColumn,
} from "@/components/ui/ChildTableGrid";

interface CustomerFormProps {
  customer?: CustomerDetail | null;
  initialValues?: Partial<CustomerFormData>;
  onSaved: () => void;
  onCancel: () => void;
}

const TABS = [
  "Basic Info",
  "Address & Contact",
  "Accounting",
  "Tax",
  "Settings",
  "Sales Team",
  "Portal Users",
  "More Info",
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
  alias: "",
  customer_name: "",
  customer_type: "Company",
  customer_group: "",
  territory: "",
  gender: "",
  lead_name: "",
  account_manager: "",
  image: "",
  default_currency: "",
  default_bank_account: "",
  default_price_list: "",
  is_internal_customer: false,
  represents_company: "",
  market_segment: "",
  industry: "",
  customer_pos_id: "",
  website: "",
  language: "",
  customer_details: "",
  tax_id: "",
  tax_category: "",
  tax_withholding_group: "",
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
  supplier_numbers: [],
};

function isBlankAddress(addr?: AddressInput): boolean {
  if (!addr) return true;
  return (
    !addr.address_line1.trim() && !addr.city.trim() && !addr.country.trim()
  );
}

export default function CustomerForm({
  customer,
  initialValues,
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
  const [taxWithholdingGroups, setTaxWithholdingGroups] = useState<string[]>([]);
  const [advanceAccountsList, setAdvanceAccountsList] = useState<string[]>([]);

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
          taxWithGroups,
          taxWithCats,
          payTerms,
          loyalty,
          partners,
          accts,
          advAccts,
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
          customerService.lookups.taxWithholdingGroups(),
          customerService.lookups.taxWithholdingCategories(),
          customerService.lookups.paymentTermsTemplates(),
          customerService.lookups.loyaltyPrograms(),
          customerService.lookups.salesPartners(),
          customerService.lookups.accounts(),
          customerService.lookups.advanceAccounts(),
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
        setTaxWithholdingGroups(taxWithGroups);
        setTaxWithholdingCategories(taxWithCats);
        setPaymentTermsTemplates(payTerms);
        setLoyaltyPrograms(loyalty);
        setSalesPartners(partners);
        setAccounts(accts);
        setAdvanceAccountsList(advAccts);
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
      setForm(initialValues ? { ...emptyForm, ...initialValues } : emptyForm);
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
      alias: customer.alias ?? "",
      customer_name: customer.customer_name,
      customer_type: customer.customer_type,
      customer_group: customer.customer_group,
      territory: customer.territory,
      gender: customer.gender ?? "",
      lead_name: customer.lead_name ?? "",
      account_manager: customer.account_manager ?? "",
      image: customer.image ?? "",
      default_currency: customer.default_currency ?? "",
      default_bank_account: customer.default_bank_account ?? "",
      default_price_list: customer.default_price_list ?? "",
      is_internal_customer: !!customer.is_internal_customer,
      represents_company: customer.represents_company ?? "",
      market_segment: customer.market_segment ?? "",
      industry: customer.industry ?? "",
      customer_pos_id: customer.customer_pos_id ?? "",
      website: customer.website ?? "",
      language: customer.language ?? "",
      customer_details: customer.customer_details ?? "",
      tax_id: customer.tax_id ?? "",
      tax_category: customer.tax_category ?? "",
      tax_withholding_group: customer.tax_withholding_group ?? "",
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
      supplier_numbers: customer.supplier_numbers ?? [],
    });
  }, [customer, initialValues]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => {
      const next = {
        ...prev,
        [name]:
          type === "checkbox"
            ? checked
            : type === "number"
              ? Number(value)
              : value,
      };
      if (name === "loyalty_program" && prev.loyalty_program !== value) {
        // loyalty_program_tier is server-generated, cleared on next save
      }
      if (name === "is_internal_customer" && !checked) {
        next.represents_company = "";
        next.companies = [];
      }
      return next;
    });
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

    if (form.is_internal_customer && !form.represents_company) {
      setError("Represents Company is required when Is Internal Customer is checked.");
      setActiveTab("Accounting");
      return;
    }

    if (form.sales_team && form.sales_team.length > 0) {
      const total = form.sales_team.reduce(
        (sum, row) => sum + (row.allocated_percentage || 0),
        0,
      );
      if (total !== 100) {
        setError(`Total contribution percentage should be equal to 100 (currently ${total}%).`);
        setActiveTab("Sales Team");
        return;
      }
    }

    const payload: CustomerFormData = {
      ...form,
      customer_name: form.customer_name.trim(),
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
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="customer_name" className={labelClass}>
                Customer Name *
              </label>
              <input
                id="customer_name"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                className={inputClass + " font-bold"}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label htmlFor="customer_type" className={labelClass}>
                Customer Type *
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
            {form.customer_type === "Individual" && (
              <div>
                <label className={labelClass}>Gender</label>
                <LinkSelect name="gender" value={form.gender} options={genders} />
              </div>
            )}
            <div>
              <label className={labelClass}>Customer Group</label>
              <LinkSelect
                name="customer_group"
                value={form.customer_group}
                options={customerGroups}
                placeholder="Select a group"
              />
            </div>
            <div>
              <label className={labelClass}>Territory</label>
              <LinkSelect
                name="territory"
                value={form.territory}
                options={territories}
                placeholder="Select a territory"
              />
            </div>
            <div>
              <label htmlFor="alias" className={labelClass}>Alias</label>
              <input
                id="alias"
                name="alias"
                value={form.alias}
                onChange={handleChange}
                className={inputClass}
                placeholder="Optional alias"
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
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">Defaults</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Billing Currency</label>
                <LinkSelect
                  name="default_currency"
                  value={form.default_currency}
                  options={currencies}
                />
              </div>
              <div>
                <label className={labelClass}>Company Bank Account</label>
                <LinkSelect
                  name="default_bank_account"
                  value={form.default_bank_account}
                  options={bankAccounts}
                />
              </div>
              <div>
                <label className={labelClass}>Price List</label>
                <LinkSelect
                  name="default_price_list"
                  value={form.default_price_list}
                  options={priceLists}
                />
              </div>
              <div>
                <label className={labelClass}>Payment Terms Template</label>
                <LinkSelect
                  name="payment_terms"
                  value={form.payment_terms}
                  options={paymentTermsTemplates}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">Loyalty Points</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Loyalty Program</label>
                <LinkSelect
                  name="loyalty_program"
                  value={form.loyalty_program}
                  options={loyaltyPrograms}
                />
              </div>
              {isEdit && customer?.loyalty_program_tier && (
                <div>
                  <label className={labelClass}>Loyalty Program Tier</label>
                  <p className="text-sm font-semibold text-heading bg-gray-50 px-3 py-2.5 rounded-[12px]">{customer.loyalty_program_tier}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Address & Contact ---------------- */}
      {activeTab === "Address & Contact" && (
        <div className="space-y-6 pt-2">
          <div>
            <p className="text-sm font-semibold text-heading mb-3">
              {isEdit ? "Primary Contact" : "Primary Contact (for new customer)"}
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
                  type="tel"
                  maxLength={15}
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
                      handleAddressChange(which, "address_line1", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Address Line 2</label>
                  <input
                    value={form[which]?.address_line2 ?? ""}
                    onChange={(e) =>
                      handleAddressChange(which, "address_line2", e.target.value)
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

      {/* ---------------- Accounting ---------------- */}
      {activeTab === "Accounting" && (
        <div className="space-y-6 pt-2">
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
                  label: "Default Account (Receivable)",
                  type: "link",
                  options: accounts,
                },
                {
                  key: "advance_account",
                  label: "Advance Account",
                  type: "link",
                  options: advanceAccountsList,
                },
              ] as GridColumn<PartyAccountRow>[]
            }
          />

          <ChildTableGrid<CreditLimitRow>
            title="Credit Limit"
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
                  label: "Bypass Check at SO",
                  type: "checkbox",
                },
              ] as GridColumn<CreditLimitRow>[]
            }
          />

          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">Internal Customer Accounting</p>
            <div className="flex items-center gap-2 mb-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Represents Company *</label>
                  <LinkSelect
                    name="represents_company"
                    value={form.represents_company}
                    options={companiesOptions}
                  />
                </div>
                <div className="col-span-2">
                  <ChildTableGrid<AllowedCompanyRow>
                    title="Allowed to Transact With"
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
                </div>
              </div>
            )}
          </div>
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
            <label className={labelClass}>Tax Withholding Group</label>
            <LinkSelect
              name="tax_withholding_group"
              value={form.tax_withholding_group}
              options={taxWithholdingGroups}
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

      {/* ---------------- Settings ---------------- */}
      {activeTab === "Settings" && (
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <input
                id="so_required"
                name="so_required"
                type="checkbox"
                checked={!!form.so_required}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="so_required" className="text-sm text-body whitespace-nowrap">
                Allow sales invoice creation without sales order
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="dn_required"
                name="dn_required"
                type="checkbox"
                checked={!!form.dn_required}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="dn_required" className="text-sm text-body whitespace-nowrap">
                Allow sales invoice creation without delivery note
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <input
                id="disabled"
                name="disabled"
                type="checkbox"
                checked={!!form.disabled}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="disabled" className="text-sm text-body">
                Disabled
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_frozen"
                name="is_frozen"
                type="checkbox"
                checked={!!form.is_frozen}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="is_frozen" className="text-sm text-body">
                Is Frozen
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Sales Team ---------------- */}
      {activeTab === "Sales Team" && (
        <div className="space-y-6 pt-2">
          <div>
            <label className={labelClass}>Account Manager</label>
            <LinkSelect
              name="account_manager"
              value={form.account_manager}
              options={users}
            />
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
                {
                  key: "allocated_percentage",
                  label: "Contribution %",
                  type: "number",
                },
              ] as GridColumn<SalesTeamRow>[]
            }
          />

          <div className="pt-4 border-t border-border">
            <p className="text-sm font-semibold text-heading mb-3">Sales Partner</p>
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
                  Commission Rate (%)
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
          </div>
        </div>
      )}

      {/* ---------------- More Info ---------------- */}
      {activeTab === "More Info" && (
        <div className="space-y-6 pt-2">
          <div>
            <p className="text-sm font-semibold text-heading mb-3">References</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Lead</label>
                <input
                  value={form.lead_name ?? ""}
                  readOnly
                  className={inputClass + " bg-gray-50 cursor-not-allowed"}
                  placeholder="Set from Lead conversion"
                />
              </div>
              <div>
                <label className={labelClass}>Opportunity</label>
                <input
                  value={form.opportunity_name ?? ""}
                  readOnly
                  className={inputClass + " bg-gray-50 cursor-not-allowed"}
                  placeholder="Set from Opportunity conversion"
                />
              </div>
              <div>
                <label className={labelClass}>Prospect</label>
                <input
                  value={form.prospect_name ?? ""}
                  readOnly
                  className={inputClass + " bg-gray-50 cursor-not-allowed"}
                  placeholder="Set from Prospect conversion"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
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
                <label htmlFor="website" className={labelClass}>Website</label>
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
              <div>
                <label htmlFor="customer_pos_id" className={labelClass}>Customer POS ID</label>
                <input
                  id="customer_pos_id"
                  name="customer_pos_id"
                  value={form.customer_pos_id}
                  readOnly
                  className={inputClass + " bg-gray-50 cursor-not-allowed"}
                  placeholder="POS-001"
                />
              </div>
              <div>
                <label htmlFor="customer_details" className={labelClass}>Customer Details</label>
                <textarea
                  id="customer_details"
                  name="customer_details"
                  value={form.customer_details}
                  onChange={handleChange}
                  rows={3}
                  className={inputClass + " resize-y"}
                  placeholder="Internal notes about this customer..."
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <ChildTableGrid<SupplierNumberRow>
              title="Supplier Numbers"
              rows={form.supplier_numbers ?? []}
              onChange={(rows) =>
                setForm((prev) => ({ ...prev, supplier_numbers: rows }))
              }
              emptyRow={{ company: "", supplier_number: "" }}
              columns={
                [
                  {
                    key: "company",
                    label: "Company",
                    type: "link",
                    options: companiesOptions,
                  },
                  {
                    key: "supplier_number",
                    label: "Supplier Number",
                    type: "text",
                  },
                ] as GridColumn<SupplierNumberRow>[]
              }
            />
          </div>
        </div>
      )}

      {/* ---------------- Portal Users ---------------- */}
      {activeTab === "Portal Users" && (
        <div className="pt-2">
          <ChildTableGrid<PortalUserRow>
            title="Customer Portal Users"
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
