import { Card, CardContent } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface Props {
  bankStatementClosingBalance: number
  erpClosingBalance: number
  difference: number
  currency: string
}

export default function NumberCards({
  bankStatementClosingBalance,
  erpClosingBalance,
  difference,
  currency,
}: Props) {
  const cards = [
    {
      label: "Closing Balance as per Bank Statement",
      value: formatCurrency(bankStatementClosingBalance, currency),
      tone: "text-heading",
    },
    {
      label: "Closing Balance as per ERP",
      value: formatCurrency(erpClosingBalance, currency),
      tone: "text-heading",
    },
    {
      label: "Difference",
      value: formatCurrency(difference, currency),
      tone: difference !== 0 ? "text-danger-600" : "text-success-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{card.label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tracking-tight", card.tone)}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
