export interface EmailTemplateSeed {
  name: string
  template_name: string
  subject: string
  response: string
  use_html: number
  enabled: number
  creation: string
  modified: string
}

export const initialEmailTemplates: EmailTemplateSeed[] = [
  {
    name: "Invoice Reminder",
    template_name: "Invoice Reminder",
    subject: "Invoice {{doc.name}} due on {{doc.due_date}}",
    response: `<p>Dear {{doc.customer_name}},</p><p>Your invoice <strong>{{doc.name}}</strong> for {{doc.grand_total}} is due on {{doc.due_date}}.</p><p>Thank you.</p>`,
    use_html: 1,
    enabled: 1,
    creation: "2026-09-01 10:00:00",
    modified: "2026-09-01 10:00:00",
  },
  {
    name: "Quotation Follow Up",
    template_name: "Quotation Follow Up",
    subject: "Quotation {{doc.name}} for {{doc.customer_name}}",
    response: `<p>Dear {{doc.customer_name}},</p><p>Please find our quotation attached.</p>`,
    use_html: 1,
    enabled: 1,
    creation: "2026-09-01 10:00:00",
    modified: "2026-09-01 10:00:00",
  },
]