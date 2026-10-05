"use client"

import { Mail, Phone, MapPin, Building2, Users, Globe, Hash, BadgeCheck, CalendarClock, AlertTriangle } from "lucide-react"
import { Card, CardContent, Badge, Avatar } from "@/components/ui"
import { type Supplier } from "@/services"

interface SupplierDetailCardProps {
  supplier: Supplier
}

function statusMeta(status: Supplier["status"]) {
  if (status === "on_hold") return { label: "On Hold", variant: "warning" as const }
  if (status === "disabled") return { label: "Disabled", variant: "default" as const }
  return { label: "Active", variant: "success" as const }
}

export default function SupplierDetailCard({ supplier }: SupplierDetailCardProps) {
  const status = statusMeta(supplier.status)

  return (
    <div className="space-y-6">
      {supplier.on_hold && (
        <div className="flex items-start gap-2 text-sm text-warning-700 bg-warning-50 border border-warning-100 px-4 py-3 rounded-[10px]">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Supplier on hold{supplier.hold_type ? ` for ${supplier.hold_type}` : ""}.
            </p>
            {supplier.on_hold_until && (
              <p className="text-xs mt-0.5">Hold until {supplier.on_hold_until}.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Avatar name={supplier.supplier_name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-heading">{supplier.supplier_name}</h1>
          <p className="text-sm text-muted">{supplier.name}</p>
        </div>
        <Badge variant={status.variant} className="ml-auto">{status.label}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <BadgeCheck size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Group</p>
                <p className="text-sm font-bold text-heading mt-1">{supplier.supplier_group || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Building2 size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Type</p>
                <p className="text-sm font-bold text-heading mt-1">{supplier.supplier_type || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Globe size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Territory / Country</p>
                <p className="text-sm font-bold text-heading mt-1">
                  {[supplier.territory, supplier.country].filter(Boolean).join(", ") || "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading">Supplier Details</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <BadgeCheck size={15} className="text-muted shrink-0" />
                <span className="text-muted w-32">Default Currency</span>
                <span className="text-body">{supplier.currency || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock size={15} className="text-muted shrink-0" />
                <span className="text-muted w-32">Payment Terms</span>
                <span className="text-body">{supplier.payment_terms || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={15} className="text-muted shrink-0" />
                <span className="text-muted w-32">Tax ID</span>
                <span className="text-body">{supplier.tax_id || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={15} className="text-muted shrink-0" />
                <span className="text-muted w-32">Website</span>
                <span className="text-body">{supplier.website || "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-bold text-heading">Contact Information</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-muted shrink-0" />
                <span className="text-body">{supplier.email_id || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-muted shrink-0" />
                <span className="text-body">{supplier.mobile_no || "—"}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{supplier.supplier_primary_address || "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}