export interface Module {
  id: string
  label: string
  description: string
  status: "active" | "coming_soon" | "stub"
  icon: string
  color: string
  route?: string
  version: string
  docsUrl?: string
  category?: string
}

export const AVAILABLE_MODULES: Module[] = [
  {
    id: "blesspos",
    label: "BlessPOS",
    description: "Point of Sale for retail and restaurants. Accept payments, manage registers, and track daily sales with a modern POS interface.",
    status: "coming_soon",
    icon: "ShoppingCart",
    color: "#2563EB",
    version: "0.1.0",
    category: "Retail",
  },
  {
    id: "blesshipping",
    label: "BlessShipping",
    description: "Logistics and delivery management. Track shipments, manage carriers, and optimize delivery routes for your business.",
    status: "coming_soon",
    icon: "Truck",
    color: "#16A34A",
    version: "0.1.0",
    category: "Logistics",
  },
  {
    id: "blessupply",
    label: "BlessSupply",
    description: "Route sales and wholesale distribution. Manage field sales, distribute products, and track route performance.",
    status: "coming_soon",
    icon: "Package",
    color: "#F59E0B",
    version: "0.1.0",
    category: "Distribution",
  },
  {
    id: "blesseats",
    label: "BlessEats",
    description: "Restaurant and food delivery operations. Manage menus, orders, kitchen workflows, and delivery integration.",
    status: "coming_soon",
    icon: "ShoppingBag",
    color: "#7C3AED",
    version: "0.1.0",
    category: "Food & Beverage",
  },
]
