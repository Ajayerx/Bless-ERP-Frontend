"use client"

import { Bell, Mail, FileText, ShoppingCart, Package, TrendingUp, Megaphone } from "lucide-react"
import { Card, CardContent } from "@/components/ui"
import { Switch } from "@/components/ui/switch"
import type { NotificationPreferences } from "@/services"

interface NotificationsTabProps {
  notifications: NotificationPreferences
  onChange: (n: NotificationPreferences) => void
}

const NOTIFICATION_ITEMS: { key: keyof NotificationPreferences; label: string; description: string; icon: React.ElementType }[] = [
  { key: "invoiceCreated", label: "Invoice Created", description: "When a new invoice is generated", icon: FileText },
  { key: "paymentReceived", label: "Payment Received", description: "When a payment is recorded against an invoice", icon: Mail },
  { key: "orderConfirmed", label: "Order Confirmed", description: "When a sales order is confirmed", icon: ShoppingCart },
  { key: "lowStock", label: "Low Stock Alert", description: "When inventory falls below threshold", icon: Package },
  { key: "weeklyReport", label: "Weekly Report", description: "Weekly sales and performance summary", icon: TrendingUp },
  { key: "monthlyReport", label: "Monthly Report", description: "Monthly financial and operational report", icon: TrendingUp },
  { key: "marketingEmails", label: "Marketing Emails", description: "Product updates, tips, and promotions", icon: Megaphone },
]

export default function NotificationsTab({ notifications, onChange }: NotificationsTabProps) {
  const toggle = (key: keyof NotificationPreferences) =>
    onChange({ ...notifications, [key]: !notifications[key] })

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-1">
        <div className="flex items-center gap-2 pb-3 border-b border-border mb-2">
          <Bell size={16} className="text-primary-600" />
          <span className="text-sm font-semibold text-heading">Notification Preferences</span>
        </div>
        {NOTIFICATION_ITEMS.map(({ key, label, description, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-gray-50 text-muted flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">{label}</p>
                <p className="text-xs text-muted">{description}</p>
              </div>
            </div>
            <Switch checked={notifications[key]} onChange={() => toggle(key)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
