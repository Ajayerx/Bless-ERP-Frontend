"use client"

import { Truck, Mail, Phone, MapPin, BadgeCheck, DollarSign, Hash } from "lucide-react"
import { Card, CardContent, Badge, Avatar } from "@/components/ui"
import { type Supplier } from "@/services"
import { formatCurrency } from "@/lib/utils"

interface SupplierDetailCardProps {
  supplier: Supplier
}

export default function SupplierDetailCard({ supplier }: SupplierDetailCardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={supplier.name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-heading">{supplier.name}</h1>
          <p className="text-sm text-muted">{supplier.contactName}</p>
        </div>
        <Badge variant={supplier.status === "active" ? "success" : "default"} className="ml-auto">
          {supplier.status === "active" ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <DollarSign size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Balance</p>
                <p className="text-2xl font-bold text-heading mt-1 tabular-nums">
                  {supplier.balance > 0 ? formatCurrency(supplier.balance) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <BadgeCheck size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Status</p>
                <p className="text-2xl font-bold text-heading mt-1 capitalize">{supplier.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Hash size={18} className="text-muted mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">Tax ID</p>
                <p className="text-2xl font-bold text-heading mt-1">{supplier.taxId || "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="font-bold text-heading">Contact Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={15} className="text-muted shrink-0" />
              <span className="text-body">{supplier.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone size={15} className="text-muted shrink-0" />
              <span className="text-body">{supplier.phone}</span>
            </div>
            {supplier.billingAddress && (
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{supplier.billingAddress}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
