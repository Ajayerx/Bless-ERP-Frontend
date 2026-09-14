"use client"

import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, ChevronDown } from "lucide-react"
import { Button, useMessageDialog } from "@/components/ui"
import {
  CREATE_ACTIONS,
  createActionLabel,
  createMenuAvailable,
  uniqueDeliveryDates,
  type CreateAction,
  type CreateOutcome,
  type CreateResult,
} from "../config/createTargets"
import { salesOrderService } from "../services"
import type { SalesOrderDoc } from "../types"
import WorkOrderDialog from "./create-dialogs/WorkOrderDialog"
import PurchaseOrderDialog from "./create-dialogs/PurchaseOrderDialog"
import RawMaterialRequestDialog from "./create-dialogs/RawMaterialRequestDialog"
import DeliveryDatesDialog from "./create-dialogs/DeliveryDatesDialog"

interface CreateMenuProps {
  doc: SalesOrderDoc
  /** Refresh the underlying Sales Order after creations that mutate its server state. */
  onDocCreated?: () => void
}

type SimpleActionKind =
  | "sales-invoice"
  | "material-request"
  | "maintenance-visit"
  | "maintenance-schedule"
  | "project"
  | "internal-purchase-order"
  | "payment-request"
  | "payment"

/**
 * Sales Order "Create" dropdown — a port of the ERPNext `refresh()` button
 * block. The visible actions mirror the doctype script's predicates; actions
 * that need a dialog (Work Order / Purchase Order / Raw Material Request /
 * multi-date Delivery Note) open it, every other action calls its mapper
 * directly. Created docs for in-app modules route to that module; anything
 * without a module keeps the "create then warn" behaviour.
 */
export default function CreateMenu({ doc, onDocCreated }: CreateMenuProps) {
  const navigate = useNavigate()
  const { showMessage } = useMessageDialog()

  const [menuOpen, setMenuOpen] = useState(false)
  const [deliveryDatesOpen, setDeliveryDatesOpen] = useState(false)
  const [workOrdersOpen, setWorkOrdersOpen] = useState(false)
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false)
  const [rawMaterialOpen, setRawMaterialOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<CreateAction | null>(null)

  const actions = useMemo(() => CREATE_ACTIONS.filter((action) => action.available(doc)), [doc])

  const labelFor = (action: CreateAction) => createActionLabel(action, doc)

  const handleOutcome = (action: CreateAction, outcome: CreateOutcome) => {
    const label = labelFor(action)
    const routed = outcome.name && action.route ? action.route(outcome as CreateResult) : null
    if (routed) {
      navigate(routed)
      return
    }
    const detail = outcome.names?.length ? outcome.names.join(", ") : outcome.name
    showMessage(
      detail
        ? `${label} module is not available yet (created ${outcome.doctype}: ${detail}).`
        : `${label} module is not available yet.`,
    )
  }

  const reportError = (action: CreateAction, err: unknown) => {
    showMessage({ message: err instanceof Error ? err.message : `Failed to create ${labelFor(action)}.` })
  }

  const runSimple = async (action: CreateAction) => {
    const simpleCall = (): Promise<CreateResult> => {
      switch (action.kind as SimpleActionKind) {
        case "sales-invoice":
          return salesOrderService.makeSalesInvoice(doc.name)
        case "material-request":
          return salesOrderService.makeMaterialRequest(doc.name)
        case "maintenance-visit":
          return salesOrderService.makeMaintenanceVisit(doc.name)
        case "maintenance-schedule":
          return salesOrderService.makeMaintenanceSchedule(doc.name)
        case "project":
          return salesOrderService.makeProject(doc.name)
        case "internal-purchase-order":
          return salesOrderService.makeInterCompanyPurchaseOrder(doc.name)
        case "payment-request":
          return salesOrderService.makePaymentRequest(doc.name)
        case "payment":
          return salesOrderService.makePaymentEntry(doc.name)
      }
      throw new Error(`Unsupported create action: ${action.kind}`)
    }
    try {
      const result = await simpleCall()
      handleOutcome(action, { doctype: result.doctype, name: result.name })
    } catch (err) {
      reportError(action, err)
    }
  }

  const handleAction = (action: CreateAction) => {
    setMenuOpen(false)
    switch (action.kind) {
      case "delivery-note": {
        const dates = uniqueDeliveryDates(doc)
        if (dates.length > 1) {
          setPendingAction(action)
          setDeliveryDatesOpen(true)
        } else {
          void runSimpleMapped(action)
        }
        return
      }
      case "work-orders":
        setWorkOrdersOpen(true)
        return
      case "purchase-order":
        setPurchaseOrderOpen(true)
        return
      case "raw-material":
        setRawMaterialOpen(true)
        return
      case "pick-list":
        showMessage("Pick List module is not available yet.")
        return
      default:
        void runSimple(action)
    }
  }

  const runSimpleMapped = async (action: CreateAction) => {
    try {
      const result = await salesOrderService.makeDeliveryNote(doc.name)
      handleOutcome(action, { doctype: result.doctype, name: result.name })
    } catch (err) {
      reportError(action, err)
    }
  }

  const handleDeliveryDates = async (dates: string[]) => {
    const action = pendingAction ?? actions.find((a) => a.kind === "delivery-note")
    if (!action) return
    try {
      const result = await salesOrderService.makeDeliveryNote(
        doc.name,
        dates.length ? { delivery_dates: dates, for_reserved_stock: false } : undefined,
      )
      onDocCreated?.()
      handleOutcome(action, { doctype: result.doctype, name: result.name })
    } catch (err) {
      reportError(action, err)
    } finally {
      setPendingAction(null)
    }
  }

  if (!createMenuAvailable(doc) || actions.length === 0) return null

  const deliveryNoteAction = actions.find((a) => a.kind === "delivery-note")

  return (
    <>
      <div className="relative">
        <Button
          size="sm"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1"
          title="Create"
        >
          <Plus size={14} /> Create <ChevronDown size={12} />
        </Button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1 max-h-96 overflow-auto">
              {actions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.key}
                    onClick={() => handleAction(action)}
                    className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Icon size={14} /> {labelFor(action)}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {deliveryNoteAction && (
        <DeliveryDatesDialog
          open={deliveryDatesOpen}
          onOpenChange={setDeliveryDatesOpen}
          dates={uniqueDeliveryDates(doc)}
          onConfirm={(dates) => void handleDeliveryDates(dates)}
        />
      )}
      <WorkOrderDialog
        open={workOrdersOpen}
        onOpenChange={setWorkOrdersOpen}
        doc={doc}
        onCreated={(names) => {
          const action = actions.find((a) => a.kind === "work-orders")
          if (action) handleOutcome(action, { doctype: "Work Order", names })
        }}
      />
      <PurchaseOrderDialog
        open={purchaseOrderOpen}
        onOpenChange={setPurchaseOrderOpen}
        doc={doc}
        onCreated={(outcome) => {
          const action = actions.find((a) => a.kind === "purchase-order")
          if (action) handleOutcome(action, outcome)
        }}
        onDocCreated={onDocCreated}
      />
      <RawMaterialRequestDialog
        open={rawMaterialOpen}
        onOpenChange={setRawMaterialOpen}
        doc={doc}
        onCreated={(outcome) => {
          const action = actions.find((a) => a.kind === "raw-material")
          if (action && outcome) handleOutcome(action, outcome)
        }}
        onDocCreated={onDocCreated}
      />
    </>
  )
}