"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useToast,
} from "@/components/ui";
import GetItemsFromModal from "./GetItemsFromModal";
import FetchTimesheetDialog from "./FetchTimesheetDialog";

interface SetterField {
  fieldname: string;
  label: string;
}

interface GetItemsSource {
  key: string;
  doctype: string;
  method: string;
  childFieldname?: string;
  childDoctype?: string;
  childColumns?: string[];
  setters?: SetterField[];
  dataFields?: Array<{ fieldname: string; label: string }>;
  searchQuery?: string;
  docLinkBase?: string;
  makeDocRoute: string;
}

const GET_ITEMS_SOURCES: GetItemsSource[] = [
  {
    key: "Sales Order",
    doctype: "Sales Order",
    method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
    childFieldname: "items",
    childDoctype: "Sales Order Item",
    childColumns: ["item_code", "item_name", "qty", "amount", "billed_amt"],
    setters: [{ fieldname: "customer", label: "Customer" }],
    docLinkBase: "/sales-orders",
    makeDocRoute: "/sales-orders",
  },
  {
    key: "Quotation",
    doctype: "Quotation",
    method: "erpnext.selling.doctype.quotation.quotation.make_sales_invoice",
    childFieldname: "items",
    childDoctype: "Quotation Item",
    childColumns: ["item_code", "item_name", "qty", "rate", "amount"],
    setters: [{ fieldname: "party_name", label: "Customer" }],
    docLinkBase: "/quotations",
    makeDocRoute: "/quotations/new",
  },
  {
    key: "Delivery Note",
    doctype: "Delivery Note",
    method: "erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice",
    childFieldname: "items",
    childDoctype: "Delivery Note Item",
    childColumns: ["item_code", "item_name", "qty", "amount", "billed_amt"],
    setters: [{ fieldname: "customer", label: "Customer" }],
    dataFields: [{ fieldname: "merge_taxes", label: "Merge taxes from multiple documents" }],
    searchQuery: "erpnext.controllers.queries.get_delivery_notes_to_be_billed",
    docLinkBase: "/inventory/transfers",
    makeDocRoute: "/inventory/transfers/new",
  },
];

interface GetItemsFromTriggerProps {
  customer?: string;
  company?: string;
  formData?: Record<string, unknown>;
  isReturn?: boolean;
  onItemsFetched: (items: Array<Record<string, unknown>>) => void;
  onTimesheetsFetched?: (rows: Array<Record<string, unknown>>) => void;
  disabled?: boolean;
}

export default function GetItemsFromTrigger({
  customer,
  company,
  formData,
  isReturn,
  onItemsFetched,
  onTimesheetsFetched,
  disabled,
}: GetItemsFromTriggerProps) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [activeSource, setActiveSource] = useState<GetItemsSource | null>(null);
  const [timesheetOpen, setTimesheetOpen] = useState(false);

  const handleDeliveryNote = () => {
    if (!customer) {
      addToast("Please Select a Customer", "warning");
      return;
    }
    const source = GET_ITEMS_SOURCES.find((s) => s.key === "Delivery Note");
    if (source) setActiveSource(source);
  };

  const hiddenSources = isReturn ? ["Sales Order", "Quotation", "Timesheet"] : [];

  const selectSource = (key: string) => {
    const source = GET_ITEMS_SOURCES.find((s) => s.key === key);
    if (source) setActiveSource(source);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get Items From
            <ChevronDown size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!hiddenSources.includes("Sales Order") && (
            <DropdownMenuItem onSelect={() => selectSource("Sales Order")}>
              Sales Order
            </DropdownMenuItem>
          )}
          {!hiddenSources.includes("Quotation") && (
            <DropdownMenuItem onSelect={() => selectSource("Quotation")}>
              Quotation
            </DropdownMenuItem>
          )}
          {!hiddenSources.includes("Timesheet") && (
            <DropdownMenuItem
              onSelect={() => {
                setTimesheetOpen(true);
              }}
            >
              Timesheet
            </DropdownMenuItem>
          )}
          {!hiddenSources.includes("Delivery Note") && (
            <>
              {isReturn && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={handleDeliveryNote}>
                Delivery Note
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeSource && (
        <GetItemsFromModal
          open={!!activeSource}
          onOpenChange={(open) => {
            if (!open) setActiveSource(null);
          }}
          sourceDoctype={activeSource.doctype}
          method={activeSource.method}
          title={`Select ${activeSource.key}`}
          setters={
            activeSource.setters?.map((s) => ({
              fieldname: s.fieldname,
              label: s.label,
              defaultValue: customer,
            }))
          }
          childDoctype={activeSource.childDoctype}
          childFieldname={activeSource.childFieldname}
          childColumns={activeSource.childColumns}
          dataFields={activeSource.dataFields}
          customer={customer}
          company={company}
          formData={formData}
          searchQuery={activeSource.searchQuery}
          docLinkBase={activeSource.docLinkBase}
          makeDocLabel={activeSource.key}
          onMakeDoc={(setterValues) => {
            const params = new URLSearchParams()
            for (const s of activeSource.setters ?? []) {
              const v = setterValues?.[s.fieldname]
              if (v) params.set(s.fieldname, v)
            }
            const qs = params.toString()
            navigate(
              qs ? `${activeSource.makeDocRoute}?${qs}` : activeSource.makeDocRoute,
            )
            setActiveSource(null)
          }}
          onItemsFetched={(fetchedItems) => {
            onItemsFetched(fetchedItems);
            setActiveSource(null);
          }}
        />
      )}

      {onTimesheetsFetched && (
        <FetchTimesheetDialog
          open={timesheetOpen}
          onOpenChange={setTimesheetOpen}
          project={(formData?.project as string) || ""}
          customer={customer}
          company={company}
          onItemsFetched={onItemsFetched}
          onTimesheetsFetched={(rows) => {
            onTimesheetsFetched(rows);
            setTimesheetOpen(false);
          }}
        />
      )}
    </>
  );
}