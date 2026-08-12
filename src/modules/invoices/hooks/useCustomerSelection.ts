"use client";

import { useCallback, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  invoiceService,
  formatExchangeRateError,
  type Customer,
  type PartyDetailsResponse,
} from "@/services";
import type { InvoiceFormData } from "../components/InvoiceForm";

interface UseCustomerSelectionParams {
  setFormData: Dispatch<SetStateAction<InvoiceFormData>>;
  formDataRef: RefObject<InvoiceFormData>;
  companyDefaults: { company: string; currency: string } | null;
  setConversionRate: (rate: number) => void;
  setPlcConversionRate: (rate: number) => void;
  setError: (error: string) => void;
  onPartyDetailsApplied?: (details: PartyDetailsResponse) => void;
}

/**
 * Mirrors ERPNext's customer-select chain on the Sales Invoice form:
 * get_party_details (debit_to, addresses, contact, payment terms, currency),
 * get_loyalty_programs, then the Link-control validate_link chain that
 * frappe fires for every link field party-details auto-sets (Account first,
 * followed by get_value(account_currency), then Address/Contact/Customer
 * Group/Territory). Loyalty follows ERPNext exactly:
 *  - 0 applicable programs -> nothing
 *  - 1 applicable program  -> server auto-sets it on the Customer doc,
 *    the form is untouched
 *  - >1 applicable programs -> surfaces loyaltyProgramOptions so the page
 *    can show the "Select Loyalty Program" dialog (whose only effect is
 *    persisting the choice to the Customer doc via set_value)
 */
export function useCustomerSelection({
  setFormData,
  formDataRef,
  companyDefaults,
  setConversionRate,
  setPlcConversionRate,
  setError,
  onPartyDetailsApplied,
}: UseCustomerSelectionParams) {
  const [loadingPartyDetails, setLoadingPartyDetails] = useState(false);
  const [loyaltyProgramOptions, setLoyaltyProgramOptions] = useState<string[]>([]);

  const handleSelectCustomer = useCallback(
    async (customer: Customer) => {
      setLoyaltyProgramOptions([]);
      setFormData((prev) => ({
        ...prev,
        customer: customer.name,
        customerName: customer.customer_name,
        // fetch_from: customer.* auto-link fields returned by validate_link
        taxId: customer.tax_id || undefined,
        loyaltyProgram: customer.loyalty_program || undefined,
        isInternalCustomer: !!customer.is_internal_customer,
        representsCompany: customer.represents_company || undefined,
      }));
      if (!companyDefaults) return;
      setLoadingPartyDetails(true);
      const postingDate =
        formDataRef.current.issueDate || new Date().toISOString().slice(0, 10);
      try {
        const [details, loyaltyPrograms] = await Promise.all([
          invoiceService.getPartyDetails(
            customer.name,
            companyDefaults.company,
            postingDate,
            {
              priceList: formDataRef.current.sellingPriceList || "",
              fetchPaymentTermsTemplate:
                !(
                  formDataRef.current.isReturn ||
                  formDataRef.current.ignoreDefaultPaymentTerms
                ),
              currency: formDataRef.current.currency || companyDefaults.currency,
            },
          ),
          invoiceService.getLoyaltyPrograms(customer.name),
        ]);
        setFormData((prev) => ({
          ...prev,
          paymentTermsTemplate:
            details.payment_terms_template || prev.paymentTermsTemplate,
          customerAddress: details.customer_address || prev.customerAddress,
          addressDisplay: details.address_display || prev.addressDisplay,
          shippingAddressName:
            details.shipping_address_name || prev.shippingAddressName,
          shippingAddress: details.shipping_address || prev.shippingAddress,
          contactPerson: details.contact_person || prev.contactPerson,
          contactDisplay: details.contact_display || prev.contactDisplay,
          contactEmail: details.contact_email || prev.contactEmail,
          contactMobile: details.contact_mobile || prev.contactMobile,
          contactPhone: details.contact_phone || prev.contactPhone,
          contactDesignation: details.contact_designation || prev.contactDesignation,
          contactDepartment: details.contact_department || prev.contactDepartment,
          debitTo: details.debit_to || prev.debitTo,
          currency: details.currency || prev.currency,
          sellingPriceList: details.selling_price_list || prev.sellingPriceList,
          priceListCurrency:
            details.price_list_currency || prev.priceListCurrency,
          dueDate: details.due_date || prev.dueDate,
          // fetch_from: customer.* fields from party details API
          taxId: details.tax_id || prev.taxId,
          language: details.language || prev.language,
          territory: details.territory || prev.territory,
          customerGroup: details.customer_group || prev.customerGroup,
          taxCategory: details.tax_category || prev.taxCategory,
          taxesAndCharges: details.taxes_and_charges || prev.taxesAndCharges,
          // Sales partner / commission from party details
          salesPartner: details.sales_partner || prev.salesPartner,
          commissionRate:
            details.commission_rate ?? prev.commissionRate,
          // Company address from party details
          companyAddress: details.company_address || prev.companyAddress,
          companyAddressDisplay:
            details.company_address_display || prev.companyAddressDisplay,
          ...(Array.isArray(details.sales_team) && details.sales_team.length > 0
            ? {
                salesTeam: details.sales_team.map((m) => ({
                  id: crypto.randomUUID(),
                  sales_person: m.sales_person,
                  allocated_percentage: m.allocated_percentage,
                  commission_rate: m.commission_rate,
                })),
              }
            : {}),
        }));

        // Link-control validate_link chain, in party-details key order.
        // debit_to additionally fires get_value(account_currency) right after
        // its validate_link (ERPNext debit_to() handler).
        if (details.debit_to) {
          await invoiceService.validateLink("Account", details.debit_to, []);
          const account = await invoiceService.getValue(
            "Account",
            "account_currency",
            { name: details.debit_to },
          );
          const accountCurrency = account.account_currency;
          if (typeof accountCurrency === "string" && accountCurrency) {
            setFormData((prev) => ({
              ...prev,
              partyAccountCurrency: accountCurrency,
            }));
          }
        }
        if (details.customer_address) {
          await invoiceService.validateLink("Address", details.customer_address, []);
        }
        if (details.contact_person) {
          await invoiceService.validateLink("Contact", details.contact_person, []);
        }
        if (details.shipping_address_name) {
          await invoiceService.validateLink(
            "Address",
            details.shipping_address_name,
            [],
          );
        }
        if (details.company_address) {
          await invoiceService.validateLink("Address", details.company_address, []);
        }
        if (details.customer_group) {
          await invoiceService.validateLink("Customer Group", details.customer_group, []);
        }
        if (details.territory) {
          await invoiceService.validateLink("Territory", details.territory, []);
        }

        if (loyaltyPrograms.length > 1) {
          setLoyaltyProgramOptions(loyaltyPrograms);
        }

        // Fetch exchange rates when currencies differ from company currency
        const partyCurrency = details.currency;
        const priceListCurrency = details.price_list_currency;
        const companyCurrency = companyDefaults.currency;

        let fxError = "";
        if (partyCurrency && partyCurrency !== companyCurrency) {
          const rate = await invoiceService.getExchangeRate(
            partyCurrency,
            companyCurrency,
            postingDate,
          );
          if (rate === 0) {
            fxError = formatExchangeRateError(partyCurrency, companyCurrency, postingDate);
            setConversionRate(0);
            setFormData((prev) => ({ ...prev, conversionRate: 0 }));
          } else {
            setConversionRate(rate);
            setFormData((prev) => ({ ...prev, conversionRate: rate }));
          }
        } else {
          setConversionRate(1);
          setFormData((prev) => ({ ...prev, conversionRate: 1 }));
        }

        if (priceListCurrency && priceListCurrency !== companyCurrency) {
          const plcRate = await invoiceService.getExchangeRate(
            priceListCurrency,
            companyCurrency,
            postingDate,
          );
          if (plcRate === 0) {
            const plcError = formatExchangeRateError(priceListCurrency, companyCurrency, postingDate);
            fxError = fxError ? `${fxError} ${plcError}` : plcError;
            setPlcConversionRate(0);
            setFormData((prev) => ({ ...prev, plcConversionRate: 0 }));
          } else {
            setPlcConversionRate(plcRate);
            setFormData((prev) => ({ ...prev, plcConversionRate: plcRate }));
          }
        } else {
          setPlcConversionRate(1);
          setFormData((prev) => ({ ...prev, plcConversionRate: 1 }));
        }
        if (fxError) setError(fxError);

        onPartyDetailsApplied?.(details);
      } catch {
        // fallback: keep basic fields set above, don't block the form
      } finally {
        setLoadingPartyDetails(false);
      }
    },
    [
      setFormData,
      formDataRef,
      companyDefaults,
      setConversionRate,
      setPlcConversionRate,
      setError,
      onPartyDetailsApplied,
    ],
  );

  const clearLoyaltyProgramOptions = useCallback(() => {
    setLoyaltyProgramOptions([]);
  }, []);

  return {
    handleSelectCustomer,
    loadingPartyDetails,
    loyaltyProgramOptions,
    clearLoyaltyProgramOptions,
  };
}
